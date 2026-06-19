-- Filename: 1. Create Tables For CollabConnect.sql
-- The purpose of this file is to make the database schema of CollabConnect
-- Author: Abbas Jabor
-- Edited by: Lucas Matheson
-- Date: November 5, 2025
-- This is the file used to create the tables in db_init

-- 1. Institution (independent table)
CREATE TABLE Institution (
    institution_id BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
    institution_name VARCHAR(200) NOT NULL,
    institution_type VARCHAR(100),
    street VARCHAR(200),
    city VARCHAR(80),
    state VARCHAR(80),
    zipcode VARCHAR(20),
    institution_phone VARCHAR(30)
);

-- 2. Department (depends on Institution)
CREATE TABLE Department (
    department_id BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
    institution_id BIGINT UNSIGNED NOT NULL,
    department_name VARCHAR(150) NOT NULL,
    department_email VARCHAR(150) UNIQUE,
    department_phone VARCHAR(15),
    CONSTRAINT fk_department_institution FOREIGN KEY (institution_id)
        REFERENCES Institution(institution_id)
        ON DELETE RESTRICT
        ON UPDATE CASCADE
);

-- 3. Person (depends on Department)
CREATE TABLE Person (
    person_id BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
    person_name VARCHAR(150) NOT NULL,
    person_email VARCHAR(150),
    person_phone VARCHAR(30),
    bio TEXT,
    expertise_1 VARCHAR(100),
    expertise_2 VARCHAR(100),
    expertise_3 VARCHAR(100),
    main_field VARCHAR(100) NOT NULL,
    department_id BIGINT UNSIGNED,
    FOREIGN KEY (department_id) REFERENCES Department(department_id)
);

-- 4. Project (no tag table, no tag FK)
CREATE TABLE Project (
    project_id BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
    project_title VARCHAR(200) NOT NULL,
    project_description TEXT,
    tag_name VARCHAR(100),
    start_date DATE NULL,
    end_date DATE,
    person_id BIGINT UNSIGNED NULL,
    CONSTRAINT fk_project_person FOREIGN KEY (person_id) REFERENCES Person(person_id)
        ON DELETE SET NULL
        ON UPDATE CASCADE
);

-- PROJECT-TAG MANY-TO-MANY (tag_name stored as VARCHAR)
CREATE TABLE Project_Tag (
    project_id BIGINT UNSIGNED NOT NULL,
    tag_name VARCHAR(100) NOT NULL,
    PRIMARY KEY (project_id, tag_name),
    FOREIGN KEY (project_id) REFERENCES Project(project_id) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS BelongsTo (
    department_id    BIGINT UNSIGNED NOT NULL,
    institution_id   BIGINT UNSIGNED NOT NULL,
    effective_start  DATE            NOT NULL,
    effective_end    DATE            DEFAULT NULL,
    PRIMARY KEY (department_id, institution_id, effective_start),
    CONSTRAINT ck_belongsto_dates CHECK (effective_end IS NULL OR effective_end >= effective_start),
    CONSTRAINT fk_belongsto_department
        FOREIGN KEY (department_id) REFERENCES Department(department_id)
        ON UPDATE CASCADE ON DELETE CASCADE,
    CONSTRAINT fk_belongsto_institution
        FOREIGN KEY (institution_id) REFERENCES Institution(institution_id)
        ON UPDATE CASCADE ON DELETE RESTRICT
);

CREATE TABLE IF NOT EXISTS WorkedOn (
    person_id      BIGINT UNSIGNED NOT NULL,
    project_id     BIGINT UNSIGNED NOT NULL,
    project_role   VARCHAR(100)    NOT NULL,
    start_date     DATE            NULL,
    end_date       DATE            DEFAULT NULL,
    PRIMARY KEY (person_id, project_id, project_role),
    CONSTRAINT ck_workedon_dates CHECK (end_date IS NULL OR end_date >= start_date),
    CONSTRAINT fk_workedon_person
        FOREIGN KEY (person_id) REFERENCES Person(person_id)
        ON UPDATE CASCADE ON DELETE CASCADE,
    CONSTRAINT fk_workedon_project
        FOREIGN KEY (project_id) REFERENCES Project(project_id)
        ON UPDATE CASCADE ON DELETE CASCADE
);

-- 3.5. WorksIn
CREATE TABLE WorksIn (
    worksin_id BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
    person_id BIGINT UNSIGNED NOT NULL,
    department_id BIGINT UNSIGNED NOT NULL,
    UNIQUE KEY uq_person_department (person_id, department_id),
    FOREIGN KEY (person_id) REFERENCES Person(person_id),
    FOREIGN KEY (department_id) REFERENCES Department(department_id)
);

-- 4. User (authentication table linked to Person with email verification)
CREATE TABLE User (
    user_id BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
    person_id BIGINT UNSIGNED UNIQUE,
    email VARCHAR(255) UNIQUE NOT NULL,
    password_hash VARCHAR(255) NOT NULL,
    is_verified BOOLEAN DEFAULT FALSE,
    verification_code VARCHAR(6),
    verification_code_expires TIMESTAMP NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    last_login TIMESTAMP NULL,
    FOREIGN KEY (person_id) REFERENCES Person(person_id) ON DELETE SET NULL
);

CREATE TABLE Conversation (
    conversation_id BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
    conversation_key VARCHAR(64) NOT NULL,
    participant_a_user_id BIGINT UNSIGNED NOT NULL,
    participant_b_user_id BIGINT UNSIGNED NOT NULL,
    created_by_user_id BIGINT UNSIGNED NOT NULL,
    last_message_id BIGINT UNSIGNED NULL,
    last_message_preview VARCHAR(280) NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    last_message_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    UNIQUE KEY uq_conversation_key (conversation_key),
    CONSTRAINT fk_conversation_participant_a
        FOREIGN KEY (participant_a_user_id) REFERENCES User(user_id)
        ON DELETE CASCADE
        ON UPDATE CASCADE,
    CONSTRAINT fk_conversation_participant_b
        FOREIGN KEY (participant_b_user_id) REFERENCES User(user_id)
        ON DELETE CASCADE
        ON UPDATE CASCADE,
    CONSTRAINT fk_conversation_created_by
        FOREIGN KEY (created_by_user_id) REFERENCES User(user_id)
        ON DELETE CASCADE
        ON UPDATE CASCADE
);

CREATE TABLE Message (
    message_id BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
    conversation_id BIGINT UNSIGNED NOT NULL,
    sender_user_id BIGINT UNSIGNED NOT NULL,
    sender_person_id BIGINT UNSIGNED NULL,
    body TEXT NOT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    read_at TIMESTAMP NULL,
    deleted_at TIMESTAMP NULL,
    CONSTRAINT fk_message_conversation
        FOREIGN KEY (conversation_id) REFERENCES Conversation(conversation_id)
        ON DELETE CASCADE
        ON UPDATE CASCADE,
    CONSTRAINT fk_message_sender_user
        FOREIGN KEY (sender_user_id) REFERENCES User(user_id)
        ON DELETE CASCADE
        ON UPDATE CASCADE,
    CONSTRAINT fk_message_sender_person
        FOREIGN KEY (sender_person_id) REFERENCES Person(person_id)
        ON DELETE SET NULL
        ON UPDATE CASCADE
);

CREATE TABLE MessageOutbox (
    id CHAR(36) PRIMARY KEY,
    aggregatetype VARCHAR(100) NOT NULL,
    aggregateid VARCHAR(100) NOT NULL,
    type VARCHAR(100) NOT NULL,
    payload JSON NOT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE MessageLoadMinute (
    minute_bucket DATETIME NOT NULL PRIMARY KEY,
    message_count BIGINT UNSIGNED NOT NULL DEFAULT 0,
    total_payload_bytes BIGINT UNSIGNED NOT NULL DEFAULT 0,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
);

CREATE TABLE MessageLoadSenderMinute (
    minute_bucket DATETIME NOT NULL,
    sender_user_id BIGINT UNSIGNED NOT NULL,
    message_count BIGINT UNSIGNED NOT NULL DEFAULT 0,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    PRIMARY KEY (minute_bucket, sender_user_id),
    CONSTRAINT fk_message_load_sender_user
        FOREIGN KEY (sender_user_id) REFERENCES User(user_id)
        ON DELETE CASCADE
        ON UPDATE CASCADE
);
