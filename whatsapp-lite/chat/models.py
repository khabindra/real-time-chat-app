import uuid
from django.db import models
from django.contrib.auth.models import AbstractUser
import hashlib

class User(AbstractUser):
    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    phone = models.CharField(max_length=20, unique=True)
    avatar = models.ImageField(upload_to='avatars/', blank=True, null=True) # Changed from URLField
    about = models.CharField(max_length=139, default="Hey there! I am using WhatsApp Lite.", blank=True)
    last_seen = models.DateTimeField(null=True, blank=True)

class Room(models.Model):
    class RoomType(models.TextChoices):
        ONE_TO_ONE = "ONE", "One-to-One"
        GROUP      = "GRP", "Group"

    id         = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    name       = models.CharField(max_length=255, blank=True)
    type       = models.CharField(max_length=3, choices=RoomType.choices, default=RoomType.ONE_TO_ONE)
    created_by = models.ForeignKey("chat.User", on_delete=models.SET_NULL, null=True, related_name="created_rooms")
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)
    room_hash  = models.CharField(max_length=64, null=True, blank=True, db_index=True)
    avatar     = models.ImageField(upload_to='group_avatars/', blank=True, null=True) # <-- ADD THIS

    class Meta:
        ordering = ("-created_at", "-id")
        constraints = [models.UniqueConstraint(fields=["room_hash"], condition=models.Q(type="ONE", room_hash__isnull=False), name="unique_one_to_one_room_hash")]

    def __str__(self): 
        return self.name or f"Room {self.id}"

    @staticmethod
    def compute_one_to_one_hash(user_a_id, user_b_id):
        import hashlib
        pair = sorted([str(user_a_id), str(user_b_id)])
        return hashlib.sha256("|".join(pair).encode()).hexdigest()

class Participant(models.Model):
    room = models.ForeignKey(Room, on_delete=models.CASCADE, related_name="participants")
    user = models.ForeignKey(User, on_delete=models.CASCADE, related_name="rooms")
    joined_at  = models.DateTimeField(auto_now_add=True)
    is_admin   = models.BooleanField(default=False)
    is_hidden  = models.BooleanField(default=False)

    class Meta:
        unique_together = ("room", "user")

class Message(models.Model):
    class Status(models.TextChoices):
        SENT = "SENT", "Sent"
        DELIVERED = "DLVR", "Delivered"
        READ = "READ", "Read"

    id         = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    room       = models.ForeignKey(Room, on_delete=models.CASCADE, related_name="messages")
    sender     = models.ForeignKey(User, on_delete=models.CASCADE, related_name="sent_messages")
    content    = models.TextField()
    status     = models.CharField(max_length=4, choices=Status.choices, default=Status.SENT)
    created_at = models.DateTimeField(auto_now_add=True)
    edited_at  = models.DateTimeField(null=True, blank=True)
    is_deleted = models.BooleanField(default=False)

    class Meta:
        ordering = ("-created_at", "-id")

class ReadReceipt(models.Model):
    message    = models.ForeignKey(Message, on_delete=models.CASCADE, related_name="receipts")
    user       = models.ForeignKey(User, on_delete=models.CASCADE, related_name="receipts")
    read_at    = models.DateTimeField(auto_now_add=True)

    class Meta:
        unique_together = ("message", "user")


class DeletedMessage(models.Model):
    """Tracks messages hidden by specific users ('Delete for Me')."""
    user = models.ForeignKey(User, on_delete=models.CASCADE, related_name="hidden_messages")
    message = models.ForeignKey(Message, on_delete=models.CASCADE, related_name="hidden_by")
    deleted_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        unique_together = ("user", "message")