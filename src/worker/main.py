import asyncio
from temporalio.client import Client
from temporalio.worker import Worker
from src.config import get_settings
from src.workflows.event import EventWorkflow
from src.activities.events import validate_event_exists, get_event_details
from src.activities.notifications import send_notification, send_notification_to_subscribers


async def main():
    settings = get_settings()
    
    # Connect to Temporal
    client = await Client.connect(settings.temporal_url)
    
    # Create worker
    worker = Worker(
        client,
        task_queue=settings.temporal_task_queue,
        workflows=[EventWorkflow],
        activities=[
            validate_event_exists,
            get_event_details,
            send_notification,
            send_notification_to_subscribers
        ]
    )
    
    print(f"🚀 Worker starting on task queue: {settings.temporal_task_queue}")
    await worker.run()


if __name__ == "__main__":
    asyncio.run(main())
