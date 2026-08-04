from rest_framework import serializers
from django.contrib.auth.password_validation import validate_password
from .models import User, Room, Participant, Message, ReadReceipt, Block


class UserSerializer(serializers.ModelSerializer):
    about = serializers.SerializerMethodField()
    last_seen = serializers.SerializerMethodField()

    class Meta:
        model = User
        fields = ("id", "username", "phone", "avatar", "about", "last_seen")
        read_only_fields = ("id", "username", "phone", "last_seen")

    def _is_blocked(self, obj, request):
        if not request or not request.user.is_authenticated: return False
        return Block.objects.filter(blocker=obj, blocked=request.user).exists()

    def get_avatar(self, obj):
        request = self.context.get('request')
        if self._is_blocked(obj, request): return None
        if obj.avatar:
            if request: return request.build_absolute_uri(obj.avatar.url)
            return obj.avatar.url
        return None

    def get_about(self, obj):
        request = self.context.get('request')
        if self._is_blocked(obj, request): return None
        return obj.about

    def get_last_seen(self, obj):
        request = self.context.get('request')
        if self._is_blocked(obj, request): return None
        return obj.last_seen.isoformat() if obj.last_seen else None

    def to_representation(self, instance):
        data = super().to_representation(instance)
        request = self.context.get('request')
        
        # Apply blocking logic to avatar
        if self._is_blocked(instance, request):
            data['avatar'] = None
        elif instance.avatar:
            if request:
                data['avatar'] = request.build_absolute_uri(instance.avatar.url)
            else:
                data['avatar'] = instance.avatar.url
        else:
            data['avatar'] = None
            
        return data


class RegisterSerializer(serializers.ModelSerializer):
    password = serializers.CharField(write_only=True, required=True, validators=[validate_password])
    password2 = serializers.CharField(write_only=True, required=True)
    phone = serializers.CharField(required=True)
    username = serializers.CharField(required=True)

    class Meta:
        model = User
        fields = ("username", "phone", "password", "password2")

    def validate_phone(self, value):
        if User.objects.filter(phone=value).exists(): raise serializers.ValidationError("Phone already exists.")
        return value

    def validate_username(self, value):
        if User.objects.filter(username=value).exists(): raise serializers.ValidationError("Username already exists.")
        return value

    def validate(self, attrs):
        if attrs['password'] != attrs['password2']: raise serializers.ValidationError({"password": "Passwords didn't match."})
        return attrs

    def create(self, validated_data):
        user = User.objects.create(username=validated_data['username'], phone=validated_data['phone'])
        user.set_password(validated_data['password'])
        user.save()
        return user

class ParticipantSerializer(serializers.ModelSerializer):
    user = UserSerializer(read_only=True)
    class Meta:
        model = Participant
        fields = ("user", "joined_at", "is_admin")


class RoomSerializer(serializers.ModelSerializer):
    participants = ParticipantSerializer(many=True, read_only=True)
    display_name = serializers.SerializerMethodField()
    last_message = serializers.SerializerMethodField()
    about = serializers.SerializerMethodField()
    avatar = serializers.ImageField(required=False, allow_null=True)
    is_blocked_by_me = serializers.SerializerMethodField()

    class Meta:
        model = Room
        fields = ("id", "name", "type", "participants", "created_at", "display_name", "last_message", "avatar", "about", "is_blocked_by_me")
        read_only_fields = ("id", "type", "participants", "created_at", "display_name", "last_message", "about", "is_blocked_by_me")

    def get_display_name(self, obj):
        if obj.type == Room.RoomType.GROUP: return obj.name or "Group Chat"
        request_user = self.context.get('request').user
        other = obj.participants.exclude(user=request_user).first()
        # FIX: Fallback to phone number if username is missing
        if other:
            return other.user.username or other.user.phone
        return "Unknown User"

    def get_last_message(self, obj):
        last_msg = obj.messages.order_by("-created_at").first()
        if last_msg:
            return {"content": last_msg.content, "created_at": last_msg.created_at.isoformat(), "sender": last_msg.sender.username, "status": last_msg.status}
        return None

    def get_about(self, instance):
        if instance.type == Room.RoomType.GROUP: return None
        request = self.context.get('request')
        if not request: return None
        other = instance.participants.exclude(user=request.user).first()
        if other:
            return UserSerializer(other.user, context={'request': request}).data.get('about')
        return None

    def get_is_blocked_by_me(self, obj):
        if obj.type == Room.RoomType.GROUP: return False
        request_user = self.context.get('request').user
        other = obj.participants.exclude(user=request_user).first()
        if other:
            return Block.objects.filter(blocker=request_user, blocked=other.user).exists()
        return False

    def to_representation(self, instance):
        data = super().to_representation(instance)
        request = self.context.get('request')
        
        if instance.type == Room.RoomType.GROUP:
            if instance.avatar:
                data['avatar'] = request.build_absolute_uri(instance.avatar.url) if request else instance.avatar.url
            else:
                data['avatar'] = None
        else:
            other = instance.participants.exclude(user=request.user).first()
            if other:
                data['avatar'] = UserSerializer(other.user, context={'request': request}).data.get('avatar')
            else:
                data['avatar'] = None
                
        return data
    
class MessageSerializer(serializers.ModelSerializer):
    sender  = UserSerializer(read_only=True)
    read_by = serializers.SerializerMethodField()

    class Meta:
        model = Message
        fields = ("id", "room", "sender", "content", "status", "edited_at", "is_deleted", "read_by", "created_at")
        read_only_fields = ("id", "sender", "status", "edited_at", "is_deleted", "read_by", "created_at")

    def get_read_by(self, obj):
        return [str(r.user_id) for r in obj.receipts.all()]

class CreateRoomSerializer(serializers.Serializer):
    participant_phones = serializers.ListField(child=serializers.CharField(), min_length=0)
    name = serializers.CharField(required=False, allow_blank=True)
    is_group = serializers.BooleanField(default=False)