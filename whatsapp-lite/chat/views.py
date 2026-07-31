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

from .models import User, Room, Participant, Message
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
        return Room.objects.filter(participants__user=self.request.user).distinct()

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
                # FIX: If you previously left this chat, re-add you as a participant so it shows in your sidebar
                Participant.objects.get_or_create(room=existing, user=request.user, defaults={'is_admin': True})
                return Response(RoomSerializer(existing, context={'request': request}).data, status=200)

        try:
            with transaction.atomic():
                room = Room.objects.create(type=Room.RoomType.GROUP if is_group else Room.RoomType.ONE_TO_ONE, name=ser.validated_data.get("name", ""), created_by=request.user, room_hash=room_hash if not is_group else None)
                Participant.objects.create(room=room, user=request.user, is_admin=True)
                Participant.objects.bulk_create([Participant(room=room, user_id=uid) for uid in unique_ids])
        except IntegrityError:
            if not is_group:
                existing = Room.objects.get(type=Room.RoomType.ONE_TO_ONE, room_hash=room_hash)
                Participant.objects.get_or_create(room=existing, user=request.user, defaults={'is_admin': True})
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
        room.delete()
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
        async_to_sync(get_channel_layer().group_send)(f"chat_{pk}", {"type": "system.kicked", "user_id": str(request.user.id)})
        return Response(status=204)

    @action(detail=True, methods=["post"], url_path="add_participants")
    def add_participants(self, request, pk=None):
        room = self.get_object()
        if not Participant.objects.filter(room=room, user=request.user, is_admin=True).exists(): return Response({"detail": "Only admins can add participants"}, status=403)
        phones = request.data.get("phones", [])
        if not phones: return Response({"detail": "phones list is required"}, status=400)
        users = list(User.objects.filter(phone__in=phones))
        if len(users) != len(phones): return Response({"detail": "Some phone numbers are not registered"}, status=400)
        existing_ids = set(Participant.objects.filter(room=room).values_list("user_id", flat=True))
        new_participants = [Participant(room=room, user=u) for u in users if u.id not in existing_ids and u.id != request.user.id]
        if new_participants: Participant.objects.bulk_create(new_participants)
        return Response({"status": "Participants added successfully"}, status=200)

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
        if not Participant.objects.filter(room=room, user=request.user).exists(): return Response({"detail": "Not a participant."}, status=403)
        qs = Message.objects.filter(room=room).select_related("sender").prefetch_related("receipts")
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