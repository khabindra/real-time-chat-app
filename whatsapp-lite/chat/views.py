import uuid
from django.db import IntegrityError, transaction
from django.shortcuts import get_object_or_404
from rest_framework.permissions import AllowAny
from rest_framework import viewsets, status, generics
from rest_framework.decorators import action
from rest_framework.parsers import MultiPartParser, FormParser,  JSONParser
from rest_framework.pagination import CursorPagination
from rest_framework.permissions import IsAuthenticated
from rest_framework.response import Response
from rest_framework.views import APIView
from rest_framework_simplejwt.tokens import RefreshToken
from rest_framework.throttling import ScopedRateThrottle
from channels.layers import get_channel_layer
from asgiref.sync import async_to_sync
from django.utils import timezone

from .models import User, Room, Participant, Message, DeletedMessage, Block
from .serializers import (UserSerializer, RoomSerializer, MessageSerializer, CreateRoomSerializer, RegisterSerializer)
from .services import mark_room_read


class LoginView(APIView):
    permission_classes = [AllowAny]
    def post(self, request):
        phone = request.data.get("phone")
        password = request.data.get("password")
        if not phone or not password: return Response({"detail": "Phone and password required."}, status=400)
        try: user = User.objects.get(phone=phone)
        except User.DoesNotExist: return Response({"detail": "Invalid credentials."}, status=401)
        if not user.check_password(password): return Response({"detail": "Invalid credentials."}, status=401)
        
        refresh = RefreshToken.for_user(user)
        # FIX: Use UserSerializer to return full profile data
        user_data = UserSerializer(user, context={'request': request}).data
        
        return Response({
            "refresh": str(refresh),
            "access": str(refresh.access_token),
            "user": user_data
        })
    
class RegisterView(generics.CreateAPIView):
    queryset = User.objects.all()
    serializer_class = RegisterSerializer
    permission_classes = []

class OnlineUsersView(APIView):
    def get(self, request):
        from .redis_client import get_sync_redis
        from django.conf import settings
        import time
        r = get_sync_redis()
        cutoff_ms = int((time.time() - settings.PRESENCE_TTL) * 1000)
        online_ids = set(r.zrangebyscore("presence:online", cutoff_ms, "+inf"))
        my_room_ids = Participant.objects.filter(user=request.user).values_list("room_id", flat=True)
        contact_ids = set(Participant.objects.filter(room_id__in=my_room_ids).exclude(user=request.user).values_list("user_id", flat=True).distinct())
        users = User.objects.filter(id__in=(online_ids & contact_ids))
        return Response(UserSerializer(users, many=True).data)

class UserListView(APIView):
    def get(self, request):
        my_room_ids = Participant.objects.filter(user=request.user).values_list("room_id", flat=True)
        contact_ids = Participant.objects.filter(room_id__in=my_room_ids).exclude(user=request.user).values_list("user_id", flat=True).distinct()
        users = User.objects.filter(id__in=contact_ids)
        return Response(UserSerializer(users, many=True).data)

class RoomCursorPagination(CursorPagination):
    page_size = 30
    ordering = ("-created_at", "-id")

class RoomViewSet(viewsets.ModelViewSet):
    permission_classes = (IsAuthenticated,)
    throttle_classes = [ScopedRateThrottle]
    pagination_class = RoomCursorPagination
    parser_classes = [MultiPartParser, FormParser, JSONParser]

    def get_throttles(self):
        if self.action in ("leave", "remove", "update", "partial_update", "destroy"): self.throttle_scope = "room_admin"
        elif self.action == "create": self.throttle_scope = "room_create"
        return super().get_throttles()

    def get_queryset(self):
        # FIX: Exclude rooms the user has "deleted" from their sidebar
        return Room.objects.filter(
            participants__user=self.request.user, 
            participants__is_hidden=False
        ).distinct()

    def get_serializer_class(self):
        return CreateRoomSerializer if self.action == "create" else RoomSerializer

    def create(self, request, *args, **kwargs):
        ser = CreateRoomSerializer(data=request.data)
        ser.is_valid(raise_exception=True)
        phones = ser.validated_data["participant_phones"]
        is_group = ser.validated_data["is_group"]
        if not is_group and len(phones) != 1: return Response({"detail": "1-to-1 rooms must have exactly 1 other participant"}, status=400)
        
        users = list(User.objects.filter(phone__in=phones))
        if len(users) != len(phones): return Response({"detail": "unknown phone numbers"}, status=400)
        if request.user.phone in phones: return Response({"detail": "cannot add yourself"}, status=400)

        user_ids = [u.id for u in users]
        unique_ids = list(dict.fromkeys(user_ids))
        room_hash = None
        if not is_group:
            room_hash = Room.compute_one_to_one_hash(request.user.id, unique_ids[0])
            existing = Room.objects.filter(type=Room.RoomType.ONE_TO_ONE, room_hash=room_hash).first()
            if existing:
                # FIX: If you previously deleted this contact, unhide it for you!
                Participant.objects.update_or_create(
                    room=existing, user=request.user,
                    defaults={'is_admin': True, 'is_hidden': False}
                )
                return Response(RoomSerializer(existing, context={'request': request}).data, status=200)

        try:
            with transaction.atomic():
                room = Room.objects.create(type=Room.RoomType.GROUP if is_group else Room.RoomType.ONE_TO_ONE, name=ser.validated_data.get("name", ""), created_by=request.user, room_hash=room_hash if not is_group else None)
                Participant.objects.create(room=room, user=request.user, is_admin=True)
                Participant.objects.bulk_create([Participant(room=room, user_id=uid) for uid in unique_ids])
        except IntegrityError:
            if not is_group:
                existing = Room.objects.get(type=Room.RoomType.ONE_TO_ONE, room_hash=room_hash)
                Participant.objects.update_or_create(
                    room=existing, user=request.user,
                    defaults={'is_admin': True, 'is_hidden': False}
                )
                return Response(RoomSerializer(existing, context={'request': request}).data, status=200)
            raise
        # FIX: Notify the other participants that a new room was created
        channel_layer = get_channel_layer()
        for uid in unique_ids:
            async_to_sync(channel_layer.group_send)(
                f"notify_{uid}",
                {"type": "new_room", "room_id": str(room.id)}
            )

        return Response(RoomSerializer(room, context={'request': request}).data, status=201)

    def destroy(self, request, *args, **kwargs):
        """Delete a room entirely (Admin for Group, either participant for 1-to-1)"""
        room = self.get_object()
        if room.type == Room.RoomType.GROUP:
            if not Participant.objects.filter(room=room, user=request.user, is_admin=True).exists():
                return Response({"detail": "Only admin can delete group"}, status=403)
        
        # FIX: Get all participant IDs before deleting the room
        participant_ids = list(Participant.objects.filter(room=room).values_list('user_id', flat=True))
        room_id_str = str(room.id)
        
        # 1. Delete the room (this cascades and deletes messages, participants, etc.)
        room.delete()
        
        # 2. Notify all participants to instantly remove the chat from their UI
        channel_layer = get_channel_layer()
        for pid in participant_ids:
            # Ping their notification socket to refresh their sidebar
            async_to_sync(channel_layer.group_send)(
                f"notify_{pid}",
                {"type": "new_room", "room_id": room_id_str} 
            )
            # Kick them if they are currently sitting inside the chat window
            async_to_sync(channel_layer.group_send)(
                f"chat_{room_id_str}",
                {"type": "system.kicked", "user_id": str(pid)}
            )
            
        return Response(status=204)

    @action(detail=True, methods=["post"], url_path="leave")
    def leave(self, request, pk=None):
        participant = get_object_or_404(Participant, room_id=pk, user=request.user)
        was_admin = participant.is_admin
        participant.delete()
        if was_admin:
            if not Participant.objects.filter(room_id=pk, is_admin=True).exists():
                new_admin = Participant.objects.filter(room_id=pk).order_by("joined_at").first()
                if new_admin:
                    new_admin.is_admin = True
                    new_admin.save(update_fields=["is_admin"])
        
        # 1. Kick the user who left
        async_to_sync(get_channel_layer().group_send)(f"chat_{pk}", {"type": "system.kicked", "user_id": str(request.user.id)})
        # 2. Notify everyone else to update their UI
        async_to_sync(get_channel_layer().group_send)(f"chat_{pk}", {"type": "room.update"})
        return Response(status=204)

    @action(detail=True, methods=["post"], url_path="add_participants")
    def add_participants(self, request, pk=None):
        room = self.get_object()
        if not Participant.objects.filter(room=room, user=request.user, is_admin=True).exists(): 
            return Response({"detail": "Only admins can add participants"}, status=403)
            
        phones = request.data.get("phones", [])
        if not phones: return Response({"detail": "phones list is required"}, status=400)
        
        users = list(User.objects.filter(phone__in=phones))
        if len(users) != len(phones): return Response({"detail": "Some phone numbers are not registered"}, status=400)
        
        existing_ids = set(Participant.objects.filter(room=room).values_list("user_id", flat=True))
        new_participants = []
        new_user_ids = []
        
        for u in users:
            if u.id not in existing_ids and u.id != request.user.id:
                new_participants.append(Participant(room=room, user=u))
                new_user_ids.append(u.id) # Track new IDs for notifications
                
        if new_participants: 
            Participant.objects.bulk_create(new_participants)
            
            # FIX: Send real-time notification to newly added users
            channel_layer = get_channel_layer()
            for uid in new_user_ids:
                async_to_sync(channel_layer.group_send)(
                    f"notify_{uid}",
                    {"type": "new_room", "room_id": str(room.id)}
                )
                
        # Notify existing participants (including admin) to update their group info UI
        async_to_sync(get_channel_layer().group_send)(f"chat_{pk}", {"type": "room.update"})
        
        return Response({"status": "Participants added successfully"}, status=200)

    @action(detail=True, methods=["post"], url_path="remove_participant")
    def remove_participant(self, request, pk=None):
        room = self.get_object()
        if not self._is_room_admin(room, request.user):
            return Response({"detail": "Only admins can remove participants"}, status=403)
            
        target_id = request.data.get("user_id")
        if not target_id: return Response({"detail": "user_id is required"}, status=400)
        if str(target_id) == str(request.user.id): return Response({"detail": "Cannot remove yourself, use /leave/"}, status=400)

        target = get_object_or_404(Participant, room=room, user_id=target_id)
        target.delete()
        
        # Notify the removed user
        async_to_sync(get_channel_layer().group_send)(f"notify_{target_id}", {"type": "new_room", "room_id": str(room.id)})
        # Kick them if they are currently connected
        async_to_sync(get_channel_layer().group_send)(f"chat_{pk}", {"type": "system.kicked", "user_id": str(target_id)})
        # FIX: Notify everyone else to update their participant list
        async_to_sync(get_channel_layer().group_send)(f"chat_{pk}", {"type": "room.update"})
        
        return Response({"status": "Participant removed"}, status=200)

    @action(detail=True, methods=["post"], url_path="clear_chat")
    def clear_chat(self, request, pk=None):
        room = self.get_object()
        if not Participant.objects.filter(room=room, user=request.user).exists():
            return Response({"detail": "Not a participant."}, status=403)
        
        # Hide all existing messages for this user
        messages = Message.objects.filter(room=room)
        for msg in messages:
            DeletedMessage.objects.get_or_create(user=request.user, message=msg)
            
        return Response({"status": "Chat cleared"}, status=200)

    @action(detail=True, methods=["post"], url_path="delete_contact")
    def delete_contact(self, request, pk=None):
        room = self.get_object()
        if room.type != Room.RoomType.ONE_TO_ONE:
            return Response({"detail": "Only for 1-to-1 chats"}, status=400)
            
        participant = get_object_or_404(Participant, room=room, user=request.user)
        participant.is_hidden = True
        participant.save(update_fields=["is_hidden"])
        
        # FIX: Also hide all existing messages so they don't reappear if the contact is re-added later
        messages = Message.objects.filter(room=room)
        for msg in messages:
            DeletedMessage.objects.get_or_create(user=request.user, message=msg)
        
        return Response({"status": "Contact deleted"}, status=200)

    def _is_room_admin(self, room, user):
        return Participant.objects.filter(room=room, user=user, is_admin=True).exists()

    # ADD/UPDATE THIS: Ensure only admins can update the group (e.g., change avatar)
    def update(self, request, *args, **kwargs):
        room = self.get_object()
        if room.type == Room.RoomType.GROUP and not self._is_room_admin(room, request.user):
            return Response({"detail": "Only admins can update group info"}, status=403)
        return super().update(request, *args, **kwargs)

    def partial_update(self, request, *args, **kwargs):
        kwargs['partial'] = True
        return self.update(request, *args, **kwargs)

class MessageCursorPagination(CursorPagination):
    page_size = 30
    ordering = ("-created_at", "-id")

class MessageHistoryView(APIView):
    permission_classes = (IsAuthenticated,)
    pagination_class = MessageCursorPagination

    def get(self, request, room_id):
        room = get_object_or_404(Room, id=room_id)
        
        # Get the participant record
        participant = get_object_or_404(Participant, room=room, user=request.user)
        
        # FIX: Only fetch messages that were sent AFTER the user joined the room
        # This ensures someone who left and rejoined doesn't see old messages.
        qs = Message.objects.filter(
            room=room, 
            created_at__gte=participant.joined_at
        ).exclude(
            hidden_by__user=request.user
        ).select_related("sender").prefetch_related("receipts")

        # FIX: Exclude messages from users I have blocked
        blocked_ids = Block.objects.filter(blocker=request.user).values_list("blocked_id", flat=True)
        qs = qs.exclude(sender_id__in=blocked_ids)

        # Message Search (optional, keep if you have it)
        search_query = request.query_params.get("search")
        if search_query:
            qs = qs.filter(content__icontains=search_query)

        paginator = self.pagination_class()
        page = paginator.paginate_queryset(qs, request, view=self)
        ser = MessageSerializer(page, many=True)
        return paginator.get_paginated_response(ser.data)
    
class MarkReadView(APIView):
    permission_classes = (IsAuthenticated,)
    def post(self, request, room_id):
        room = get_object_or_404(Room, id=room_id)
        if not Participant.objects.filter(room=room, user=request.user).exists(): return Response({"detail": "Not a participant."}, status=403)
        last_id = request.data.get("last_message_id")
        try: uuid.UUID(str(last_id))
        except: return Response({"detail": "invalid last_message_id format"}, status=400)
        created = mark_room_read(room, request.user, last_id)
        if created:
            async_to_sync(get_channel_layer().group_send)(f"chat_{room_id}", {"type": "chat.read", "reader_id": str(request.user.id), "reader": request.user.username, "last_message_id": last_id, "read_at": timezone.now().isoformat()})
        return Response({"marked_read": created})


class ProfileView(APIView):
    permission_classes = (IsAuthenticated,)
    parser_classes = [MultiPartParser, FormParser]

    def get(self, request, user_id=None):
        if user_id:
            user = get_object_or_404(User, id=user_id)
        else:
            user = request.user
        return Response(UserSerializer(user, context={'request': request}).data)

    def patch(self, request):
        user = request.user
        serializer = UserSerializer(user, data=request.data, partial=True, context={'request': request})
        if serializer.is_valid():
            serializer.save()
            return Response(serializer.data)
        return Response(serializer.errors, status=400)


class DeleteMessageView(APIView):
    permission_classes = (IsAuthenticated,)

    def post(self, request, message_id):
        msg = get_object_or_404(Message, id=message_id)
        # Ensure the user is part of the room
        if not Participant.objects.filter(room=msg.room, user=request.user).exists():
            return Response({"detail": "Not authorized."}, status=403)
        # Create the hide record
        DeletedMessage.objects.get_or_create(user=request.user, message=msg)
        return Response(status=204)


# --- ADD THESE NEW VIEWS ---
class BlockUserView(APIView):
    permission_classes = (IsAuthenticated,)
    def post(self, request, user_id):
        blocked_user = get_object_or_404(User, id=user_id)
        if blocked_user == request.user: return Response({"detail": "Cannot block yourself"}, status=400)
        Block.objects.get_or_create(blocker=request.user, blocked=blocked_user)
        return Response({"status": "User blocked"}, status=200)

class UnblockUserView(APIView):
    permission_classes = (IsAuthenticated,)
    def post(self, request, user_id):
        blocked_user = get_object_or_404(User, id=user_id)
        Block.objects.filter(blocker=request.user, blocked=blocked_user).delete()
        return Response({"status": "User unblocked"}, status=200)

class BlockedUsersView(APIView):
    permission_classes = (IsAuthenticated,)
    def get(self, request):
        blocked_ids = Block.objects.filter(blocker=request.user).values_list("blocked_id", flat=True)
        users = User.objects.filter(id__in=blocked_ids)
        return Response(UserSerializer(users, many=True, context={'request': request}).data)