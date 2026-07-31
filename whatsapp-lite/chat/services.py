from django.utils import timezone
from .models import Message, ReadReceipt

def mark_room_read(room, reader, last_message_id=None):
    msgs = Message.objects.filter(room=room).exclude(sender=reader)
    if last_message_id:
        try: anchor = msgs.get(id=last_message_id)
        except Message.DoesNotExist: return 0
        msgs = msgs.filter(created_at__lte=anchor.created_at)

    msgs.filter(status__in=[Message.Status.SENT, Message.Status.DELIVERED]).update(status=Message.Status.READ)
    missing_msgs = list(msgs.exclude(receipts__user=reader))
    now = timezone.now()
    ReadReceipt.objects.bulk_create([ReadReceipt(message=m, user=reader, read_at=now) for m in missing_msgs], ignore_conflicts=True)
    return len(missing_msgs)

def mark_room_delivered(room, reader):
    msgs = Message.objects.filter(room=room, status=Message.Status.SENT).exclude(sender=reader)
    updated_ids = [str(uid) for uid in msgs.values_list("id", flat=True)]
    msgs.update(status=Message.Status.DELIVERED)
    return updated_ids