CREATE TABLE users (
	id INTEGER NOT NULL, 
	email VARCHAR(255) NOT NULL, 
	name VARCHAR(255) NOT NULL, 
	is_active BOOLEAN NOT NULL, 
	created_at DATETIME DEFAULT CURRENT_TIMESTAMP, 
	updated_at DATETIME, 
	PRIMARY KEY (id)
);
CREATE UNIQUE INDEX ix_users_email ON users (email);
CREATE INDEX ix_users_id ON users (id);
CREATE TABLE events (
	id INTEGER NOT NULL, 
	name VARCHAR(255) NOT NULL, 
	description TEXT, 
	start_date DATETIME NOT NULL, 
	end_date DATETIME NOT NULL, 
	is_public BOOLEAN NOT NULL, 
	is_active BOOLEAN NOT NULL, 
	owner_user_id INTEGER NOT NULL, 
	workflow_id VARCHAR(255), 
	created_at DATETIME DEFAULT CURRENT_TIMESTAMP, 
	updated_at DATETIME, 
	PRIMARY KEY (id), 
	FOREIGN KEY(owner_user_id) REFERENCES users (id)
);
CREATE INDEX ix_events_id ON events (id);
CREATE UNIQUE INDEX ix_events_workflow_id ON events (workflow_id);
CREATE TABLE integrations (
	id INTEGER NOT NULL, 
	user_id INTEGER NOT NULL, 
	name VARCHAR(255) NOT NULL, 
	apprise_url TEXT NOT NULL, 
	is_active BOOLEAN NOT NULL, 
	created_at DATETIME DEFAULT CURRENT_TIMESTAMP, 
	updated_at DATETIME, 
	PRIMARY KEY (id), 
	FOREIGN KEY(user_id) REFERENCES users (id)
);
CREATE INDEX ix_integrations_id ON integrations (id);
CREATE TABLE event_participants (
	id INTEGER NOT NULL, 
	event_id INTEGER NOT NULL, 
	user_id INTEGER NOT NULL, 
	integration_id INTEGER NOT NULL, 
	is_active BOOLEAN NOT NULL, 
	reminder_preferences TEXT, 
	created_at DATETIME DEFAULT CURRENT_TIMESTAMP, 
	PRIMARY KEY (id), 
	FOREIGN KEY(event_id) REFERENCES events (id), 
	FOREIGN KEY(user_id) REFERENCES users (id), 
	FOREIGN KEY(integration_id) REFERENCES integrations (id)
);
CREATE INDEX ix_event_participants_id ON event_participants (id);
