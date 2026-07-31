from django.contrib import admin
from django.contrib.auth.admin import UserAdmin
from .models import User, Room, Participant, Message, ReadReceipt
admin.site.register(User, UserAdmin)
admin.site.register(Room)
admin.site.register(Participant)
admin.site.register(Message)
admin.site.register(ReadReceipt)
