from django.urls import path, include
from rest_framework.routers import DefaultRouter
from .views import (LoginView, RegisterView, OnlineUsersView, 
                    UserListView, RoomViewSet, MessageHistoryView, 
                    MarkReadView,ProfileView,DeleteMessageView,
                    BlockUserView, UnblockUserView, BlockedUsersView)

router = DefaultRouter()
router.register("rooms", RoomViewSet, basename="room")

urlpatterns = [
    path("auth/login/", LoginView.as_view(), name="login"),
    path("auth/register/", RegisterView.as_view(), name="register"),
    path("users/", UserListView.as_view(), name="users"),
    path("users/online/", OnlineUsersView.as_view(), name="online-users"),
    path("rooms/<uuid:room_id>/messages/", MessageHistoryView.as_view(), name="messages"),
    path("rooms/<uuid:room_id>/read/", MarkReadView.as_view(), name="mark-read"),

    path("users/me/", ProfileView.as_view(), name="my-profile"),
    path("users/<uuid:user_id>/", ProfileView.as_view(), name="user-profile"),

    path("messages/<uuid:message_id>/delete/", DeleteMessageView.as_view(), name="delete-message"),

    # Block/Unblock Routes
    path("users/<uuid:user_id>/block/", BlockUserView.as_view(), name="block-user"),
    path("users/<uuid:user_id>/unblock/", UnblockUserView.as_view(), name="unblock-user"),
    path("users/blocked/", BlockedUsersView.as_view(), name="blocked-users"),
    path("", include(router.urls)),
]