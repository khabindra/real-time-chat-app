# chat/admin.py
from django.contrib import admin
from django.contrib.auth.admin import UserAdmin
from .models import User, Room, Participant, Message, ReadReceipt

@admin.register(User)
class CustomUserAdmin(UserAdmin):
    list_display = ('username', 'phone', 'about', 'last_seen', 'is_active', 'is_staff')
    search_fields = ('username', 'phone')
    list_filter = ('is_active', 'is_staff', 'is_superuser')
    ordering = ('-date_joined',)

@admin.register(Room)
class RoomAdmin(admin.ModelAdmin):
    list_display = ('name', 'type', 'created_by', 'created_at', 'avatar_tag')
    search_fields = ('name', 'participants__username', 'participants__phone')
    list_filter = ('type', 'created_at')
    autocomplete_fields = ['created_by']
    readonly_fields = ('room_hash', 'created_at', 'updated_at')
    
    # Custom method to show avatar thumbnail in list view
    def avatar_tag(self, obj):
        if obj.avatar:
            return f'<img src="{obj.avatar.url}" style="width: 40px; height: 40px; border-radius: 50%; object-fit: cover;" />'
        return "-"
    avatar_tag.short_description = 'Group Avatar'
    avatar_tag.allow_tags = True

@admin.register(Participant)
class ParticipantAdmin(admin.ModelAdmin):
    list_display = ('user', 'room', 'is_admin', 'joined_at')
    search_fields = ('user__username', 'room__name')
    list_filter = ('is_admin',)
    autocomplete_fields = ['user', 'room']

@admin.register(Message)
class MessageAdmin(admin.ModelAdmin):
    list_display = ('sender', 'room', 'short_content', 'status', 'is_deleted', 'created_at')
    search_fields = ('content', 'sender__username', 'room__name')
    list_filter = ('status', 'is_deleted', 'created_at')
    readonly_fields = ('created_at', 'edited_at')
    autocomplete_fields = ['room', 'sender']
    
    def short_content(self, obj):
        return (obj.content[:50] + '...') if len(obj.content) > 50 else obj.content
    short_content.short_description = 'Content'

@admin.register(ReadReceipt)
class ReadReceiptAdmin(admin.ModelAdmin):
    list_display = ('message', 'user', 'read_at')
    search_fields = ('user__username', 'message__content')
    autocomplete_fields = ['message', 'user']