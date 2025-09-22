"""
Complete event lifecycle demo for the Soonish notification service.
Demonstrates the full flow from event creation to completion with real notifications.

Lifecycle:
1. Event gets created in database
2. User subscribes with Gotify notification integration
3. Event gets updated and user receives notification
4. Event happens/ends and workflow finishes gracefully
"""
import asyncio
import logging
import sys
import os
from datetime import datetime, timedelta
from temporalio.client import Client

# Add src to path for imports
sys.path.insert(0, os.path.join(os.path.dirname(__file__), 'src'))

# Import our models, workflows, and database
from models import ParticipantData, EventUpdateData
from workflows.event import EventWorkflow
from config import settings
from db_service import DatabaseService

# Configure logging
logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)


async def main():
    """Complete event lifecycle demonstration."""
    logger.info("=== Starting Soonish Full Event Lifecycle Demo ===")
    
    try:
        # Connect to Temporal
        client = await Client.connect(
            target_host=settings.temporal_url,
            namespace=settings.temporal_namespace,
        )
        logger.info("✓ Connected to Temporal server")
        
        # === STEP 1: Create Event ===
        logger.info("\n--- STEP 1: Creating Event ---")
        
        # Create event that starts in 5 minutes and lasts 2 minutes (for quick demo)
        start_time = datetime.utcnow() + timedelta(minutes=5)
        end_time = start_time + timedelta(minutes=2)
        
        event_data = {
            "name": "Team Standup Meeting",
            "description": "Daily team standup to discuss progress and blockers",
            "start_date": start_time.isoformat() + "Z",
            "end_date": end_time.isoformat() + "Z",
            "owner_user_id": 1,
            "is_public": True
        }
        
        logger.info(f"Event: {event_data['name']}")
        logger.info(f"Start time: {start_time} UTC")
        logger.info(f"End time: {end_time} UTC")
        logger.info(f"Current time: {datetime.utcnow()} UTC")
        
        # Create event in database
        with DatabaseService() as db:
            event = db.create_event(
                name=event_data["name"],
                description=event_data["description"],
                start_date=start_time,
                end_date=end_time,
                owner_user_id=event_data["owner_user_id"],
                is_public=event_data["is_public"]
            )
            
            # Ensure transaction is committed and validate
            db.db.commit()
            if not db.validate_event_exists(event.id):
                raise RuntimeError(f"Failed to create event {event.id} in database")
            
            event_id = event.id
            event_data["id"] = event_id
            
            logger.info(f"✓ Event created in database with ID: {event_id}")
        
        # Start EventWorkflow
        workflow_id = f"lifecycle-{event_id}-{int(datetime.now().timestamp())}"
        logger.info(f"Starting EventWorkflow with ID: {workflow_id}")
        
        workflow_handle = await client.start_workflow(
            EventWorkflow.run,
            args=[event_id, event_data],
            id=workflow_id,
            task_queue=settings.temporal_task_queue,
            execution_timeout=timedelta(days=1),  # Shorter for demo
        )
        
        # Verify workflow started
        try:
            await workflow_handle.describe()
            logger.info("✓ EventWorkflow started successfully")
        except Exception as e:
            logger.error(f"✗ Workflow failed to start: {e}")
            raise
        
        # === STEP 2: User Subscribes ===
        logger.info("\n--- STEP 2: User Subscribes to Event ---")
        
        with DatabaseService() as db:
            # Get demo user and their Gotify integration
            user = db.get_user_by_email("demo@example.com")
            if not user:
                logger.error("✗ Demo user not found. Please run scripts/init_db.py first")
                return
            
            integrations = db.get_user_integrations(user.id)
            if not integrations:
                logger.error("✗ No integrations found for demo user")
                return
            
            gotify_integration = integrations[0]  # Should be the Gotify integration
            logger.info(f"✓ Using integration: {gotify_integration.name}")
            logger.info(f"  Apprise URL: {gotify_integration.apprise_url}")
            
            # Subscribe demo user to the event with reminder preferences
            print("\n=== Step 2: User Subscription with Reminders ===")
            participant = db.add_event_participant(
                event_id=event_id,
                user_id=user.id,
                integration_id=gotify_integration.id,
                reminder_preferences='{"enabled": true, "note": "Reminder configuration will be implemented later"}'
            )
            print(f"Demo user subscribed as participant {participant.id}")
            print(f"Reminder preferences: {participant.reminder_preferences}")
            
            # Signal the workflow about the new participant with reminder preferences
            participant_data = ParticipantData(
                subscription_id=participant.id,
                user_id=user.id,
                integration_id=gotify_integration.id,
                email=user.email,
                reminder_preferences=participant.reminder_preferences
            )
            
            await workflow_handle.signal("participant_added", participant_data)
            logger.info("✓ Workflow notified of new participant")
        
        # === STEP 3: Event Update ===
        logger.info("\n--- STEP 3: Event Update with Notification ---")
        
        with DatabaseService() as db:
            # Update event in database
            updated_event = db.update_event(
                event_id,
                name="Team Standup Meeting - URGENT: Location Changed",
                description="IMPORTANT: Meeting moved to Conference Room B due to AV issues in Room A"
            )
            
            logger.info(f"✓ Event updated in database: {updated_event.name}")
            
            # Signal workflow about update
            update_data = EventUpdateData(
                event_id=event_id,
                updated_fields={
                    "name": updated_event.name,
                    "description": updated_event.description
                },
                notification_title="Event Update: Location Changed",
                notification_body="The meeting location has been changed to Conference Room B due to technical issues."
            )
            
            await workflow_handle.signal("event_updated", update_data)
            logger.info("✓ Event update notification sent to participants")
        
        # === STEP 4: Wait for Event to Complete ===
        logger.info("\n--- STEP 4: Waiting for Event Lifecycle to Complete ---")
        
        logger.info(f"Event will start in {(start_time - datetime.utcnow()).total_seconds():.0f} seconds")
        logger.info(f"Event will end in {(end_time - datetime.utcnow()).total_seconds():.0f} seconds")
        logger.info("Workflow will continue running until event ends...")
        
        # Show current workflow status
        status = await workflow_handle.describe()
        logger.info(f"Workflow status: {status.status}")
        
        # Wait for workflow to complete naturally (when event ends)
        logger.info("Waiting for workflow to complete when event ends...")
        try:
            result = await asyncio.wait_for(workflow_handle.result(), timeout=600)  # 10 minutes
            logger.info(f"✓ Workflow completed successfully: {result}")
        except asyncio.TimeoutError:
            logger.info("⏱ Workflow still running (demo timeout reached)")
            status = await workflow_handle.describe()
            logger.info(f"Current workflow status: {status.status}")
        except Exception as e:
            logger.error(f"✗ Workflow failed: {e}")
            try:
                status = await workflow_handle.describe()
                logger.info(f"Current workflow status: {status.status}")
            except Exception:
                pass
        
        # === Final Status ===
        logger.info("\n--- FINAL STATUS ---")
        
        with DatabaseService() as db:
            participants = db.get_event_participants(event_id)
            logger.info(f"Total participants: {len(participants)}")
            for p in participants:
                logger.info(f"  - {p['user_name']} ({p['user_email']}) via {p['integration_name']}")
        
        logger.info("\n=== Event Lifecycle Demo Complete ===")
        logger.info("Check your Gotify notifications to see the real-time updates!")
        
    except Exception as e:
        logger.error(f"Demo failed: {e}")
        raise


if __name__ == "__main__":
    asyncio.run(main())
