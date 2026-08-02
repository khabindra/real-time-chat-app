from django.utils import timezone
from .models import Message, ReadReceipt

def mark_room_read(room, reader, last_message_id=None):
    """Bulk-mark every message in `room` (not sent by `reader`) as read."""
    msgs = Message.objects.filter(room=room).exclude(sender=reader)
    if last_message_id:
        try:
            anchor = msgs.get(id=last_message_id)
        except Message.DoesNotExist:
            return 0
        msgs = msgs.filter(created_at__lte=anchor.created_at)

    # Add read receipts for the reader
    missing_msgs = list(msgs.exclude(receipts__user=reader))
    now = timezone.now()
    ReadReceipt.objects.bulk_create(
        [ReadReceipt(message=m, user=reader, read_at=now) for m in missing_msgs],
        ignore_conflicts=True,
    )

    # FIX: Only update message status to READ if ALL participants have read it
    updated_count = 0
    for msg in msgs:
        if msg.status == Message.Status.READ:
            continue
        
        # Count how many people are in the room (excluding the sender)
        required_readers = room.participants.exclude(user_id=msg.sender_id).count()
        actual_readers = msg.receipts.count()
        
        if actual_readers >= required_readers:
            msg.status = Message.Status.READ
            msg.save(update_fields=['status'])
            updated_count += 1
            
    return updated_count

def mark_room_delivered(room, reader):
    msgs = Message.objects.filter(room=room, status=Message.Status.SENT).exclude(sender=reader)
    updated_ids = [str(uid) for uid in msgs.values_list("id", flat=True)]
    msgs.update(status=Message.Status.DELIVERED)
    return updated_ids