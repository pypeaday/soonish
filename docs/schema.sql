CREATE TABLE users (
	id INTEGER NOT NULL,
	email VARCHAR(255) NOT NULL,
	name VARCHAR(255) NOT NULL,
	is_verified BOOLEAN NOT NULL DEFAULT 0,
	created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
	PRIMARY KEY (id)
);
CREATE UNIQUE INDEX ix_users_email ON users (email);
CREATE INDEX ix_users_id ON users (id);
CREATE TABLE events (
	id INTEGER NOT NULL,
	name VARCHAR(255) NOT NULL,
	start_date DATETIME NOT NULL,
	end_date DATETIME,
	is_public BOOLEAN NOT NULL DEFAULT 1,
	messaging_policy VARCHAR(64) NOT NULL DEFAULT 'off',
	temporal_workflow_id VARCHAR(255) NOT NULL,
	created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
	PRIMARY KEY (id)
);
CREATE INDEX ix_events_id ON events (id);
CREATE UNIQUE INDEX ix_events_temporal_workflow_id ON events (temporal_workflow_id);
CREATE TABLE integrations (
	id INTEGER NOT NULL,
	user_id INTEGER NOT NULL,
	name VARCHAR(255) NOT NULL,
	apprise_url TEXT NOT NULL,
	tag VARCHAR(255) NOT NULL,
	is_active BOOLEAN NOT NULL DEFAULT 1,
	created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
	PRIMARY KEY (id),
	FOREIGN KEY(user_id) REFERENCES users (id)
);
CREATE INDEX ix_integrations_id ON integrations (id);
CREATE INDEX ix_integrations_user_id ON integrations (user_id);
CREATE UNIQUE INDEX uq_integrations_user_url_tag ON integrations (user_id, apprise_url, tag);
CREATE TABLE subscriptions (
	id INTEGER NOT NULL,
	event_id INTEGER NOT NULL,
	user_id INTEGER,
	created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
	PRIMARY KEY (id),
	FOREIGN KEY(event_id) REFERENCES events (id),
	FOREIGN KEY(user_id) REFERENCES users (id)
);
CREATE UNIQUE INDEX uq_subscriptions_event_user ON subscriptions (event_id, user_id);
CREATE INDEX ix_subscriptions_event_id ON subscriptions (event_id);

CREATE TABLE subscription_selectors (
	id INTEGER NOT NULL,
	subscription_id INTEGER NOT NULL,
	integration_id INTEGER,
	tag VARCHAR(255),
	created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
	PRIMARY KEY (id),
	FOREIGN KEY(subscription_id) REFERENCES subscriptions (id),
	FOREIGN KEY(integration_id) REFERENCES integrations (id)
);
CREATE INDEX ix_subscription_selectors_subscription_id ON subscription_selectors (subscription_id);
CREATE UNIQUE INDEX uq_subscription_selectors_sub_integration ON subscription_selectors (subscription_id, integration_id) WHERE integration_id IS NOT NULL;
CREATE UNIQUE INDEX uq_subscription_selectors_sub_tag ON subscription_selectors (subscription_id, tag) WHERE tag IS NOT NULL;

CREATE TABLE event_updates (
	id INTEGER NOT NULL,
	event_id INTEGER NOT NULL,
	category VARCHAR(255) NOT NULL,
	title VARCHAR(255) NOT NULL,
	body TEXT NOT NULL,
	created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
	PRIMARY KEY (id),
	FOREIGN KEY(event_id) REFERENCES events (id)
);
CREATE INDEX ix_event_updates_event_id ON event_updates (event_id);

CREATE TABLE event_memberships (
	id INTEGER NOT NULL,
	event_id INTEGER NOT NULL,
	user_id INTEGER NOT NULL,
	role VARCHAR(16) NOT NULL,
	created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
	PRIMARY KEY (id),
	FOREIGN KEY(event_id) REFERENCES events (id),
	FOREIGN KEY(user_id) REFERENCES users (id)
);
CREATE INDEX ix_event_memberships_event_id ON event_memberships (event_id);
CREATE INDEX ix_event_memberships_user_id ON event_memberships (user_id);
CREATE UNIQUE INDEX uq_event_memberships_event_user ON event_memberships (event_id, user_id);

CREATE TABLE event_messages (
	id INTEGER NOT NULL,
	event_id INTEGER NOT NULL,
	author_user_id INTEGER NOT NULL,
	title VARCHAR(255),
	body TEXT NOT NULL,
	category VARCHAR(255),
	status VARCHAR(16) NOT NULL,
	reply_to_message_id INTEGER,
	created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
	PRIMARY KEY (id),
	FOREIGN KEY(event_id) REFERENCES events (id),
	FOREIGN KEY(author_user_id) REFERENCES users (id),
	FOREIGN KEY(reply_to_message_id) REFERENCES event_messages (id)
);
CREATE INDEX ix_event_messages_event_id ON event_messages (event_id);
CREATE INDEX ix_event_messages_event_status ON event_messages (event_id, status);
CREATE INDEX ix_event_messages_event_created ON event_messages (event_id, created_at);

CREATE TABLE event_messaging_whitelist (
	id INTEGER NOT NULL,
	event_id INTEGER NOT NULL,
	user_id INTEGER NOT NULL,
	created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
	PRIMARY KEY (id),
	FOREIGN KEY(event_id) REFERENCES events (id),
	FOREIGN KEY(user_id) REFERENCES users (id)
);
CREATE UNIQUE INDEX uq_event_messaging_whitelist ON event_messaging_whitelist (event_id, user_id);
