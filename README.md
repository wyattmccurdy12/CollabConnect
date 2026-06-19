## Docker Compose

Use Compose for deployment-style startup:

```bash
cp .env.example .env
docker compose -f compose.yaml up -d --build
```

Use the dev override for hot reload during local development:

```bash
cp .env.example .env
docker compose -f compose.dev.yaml up --build
```

The production stack runs MySQL, a one-shot database init job, the Flask backend under gunicorn, and the frontend behind nginx. The dev stack keeps Flask and React in watch mode.

## Kafka Outbox + Message Load Tracking (Option 2)

The dev stack now includes Apache Kafka, Debezium Kafka Connect, a connector bootstrap job, and a message metrics consumer.

### Services

- `kafka` + `zookeeper`: message broker for event streams
- `kafka-connect`: Debezium Connect runtime
- `kafka-connect-init`: registers the MySQL outbox connector on startup
- `message-metrics-consumer`: consumes `collabconnect.outbox.message.sent.v1` and writes minute-level aggregates
- `kafka-ui`: inspect topics/connectors at `http://localhost:8080`

### Start stack

```bash
cp .env.example .env
docker compose -f compose.dev.yaml up --build -d
```

### Seed dummy accounts

```bash
docker compose -f compose.dev.yaml exec -T backend \
  python scripts/create_dummy_message_accounts.py --prefix simuser --count 50 --password SimPass1234
```

### Run load simulation

```bash
docker compose -f compose.dev.yaml exec -T backend \
  python scripts/simulate_message_load.py --base-url http://backend:5001 --prefix simuser --count 50 --password SimPass1234 --total-messages 1000 --workers 10
```

The simulator prints `simulation_run_id`. The backend also forwards this ID using header `X-Simulation-Run-Id`, and it is persisted in outbox event payloads.

### Admin load endpoints

- `GET /api/analytics/message-load/summary?lookback_minutes=60`
- `GET /api/analytics/message-load/senders?lookback_minutes=60&limit=20`

### Event topic

Debezium outbox routes message sent events into:

- `collabconnect.outbox.message.sent.v1`
# CollabConnect - Course Project for COS457

CollabConnect is an application that facilitates collaboration and connection between academics and industry professionals. It addresses the gap between wanting or needing a collaborator for a project and finding a suitable collaborator. The app will provide users the opportunity to search a directory of potential collaborators and view attributes of professional peers that make them a good match for the proposed project. A user may also visualize graphs of connections between professionals for better decision-making and understanding.

# Team Contributions Phase 1
## Abbas Jabor (abbas.jabor@maine.edu) LEADER - jabobas
* MAIN TASK: Normal Form Discussion
* ER Diagram (draft 1)
* Interviewed Timothy Burke
* Normal Forms Discussion
* Worked on the presentation
## Aubin Mugisha (aubin.mugisha@maine.edu) - Aubin01
* MAIN TASK: Complete the ER Diagram and do the Data Dictionary
* ER Diagram (draft 3)
* Data dictionary
* Cardinalities
* Worked on the presentation
## Lucas Matheson (lucas.matheson@maine.edu) - lmatheson2026
* Collected survey results, summarized them
* Designed survey
* Interviewed David Levine
* Analyzed/organized survey results
* Also created a requirement document based on interviews
* Worked on the presentation
## Wyatt McCurdy (wyatt.mccurdy@maine.edu) - wyattmccurdy12
* MAIN TASK: Requirements Document
* ER Diagram (draft 2)
* Requirements document
* Helped interview Timothy Burke
* Worked on the presentation


# Team contributions Phase 2
Phase 2 Project Responsibilities
Websites scraped: 
- https://usm.maine.edu/department-computer-science/people/ 
- https://reporter.nih.gov/
- https://roux.northeastern.edu/our-people/

Abbas: 
- Create Table Project, Tag, ProjectTag (Nov 2)
- CRUD for Project, Tag, ProjectTag (Nov 5)
- Provide Index Commands for Project, Tag, ProjectTag (Nov 2)
- Function/Stored Procedure Project, Tag, ProjectTag (Nov 5)
- Try to scrape https://reporter.nih.gov/ for industry(Nov 10)
- Try to scrape or find a library of tags for the Tags table (Nov 10)


Lucas: 
- Created tables department and institution
- Stored procedures for department and institution
- Scrape USM’s departments
    - Starting with https://usm.maine.edu/department-computer-science/people/
- Created general db creation in python
- db_init.py creates database, all tables, indexes, and procedures
- Formatted all json to be inserted into the database
- app.py creates flask app to interact with MySQL Workbench
- General code review, updates to procedures, tables, and functions to better fit project requirements
- Created baseline unit tests for department, instituion, and person to ensure database is functional before data insertion


Wyatt: 
- Created Table Person, relation WorksIn (Nov 2) 
- Write CRUD for Person, WorksIn (Nov 5)
- Write Index commands for Person, WorksIn (Nov 2)
- Create Function/Stored Procedure Person (Nov 5)
- Query Optimization on 1 query
-> Scraping the https://roux.northeastern.edu/our-people/ for all tables


Aubin: 
- Create Tables WorkedOn, BelongsTo  (Nov 2)
- Write CRUD for WorkedOn, BelongsTo (Nov 5)
- Create Index commands for WorkedOn, BelongsTo (Nov 2)
- CreateFunction/Stored Procedure WorkedOn, BelongsTo (Nov 10)
- Scrape site https://reporter.nih.gov/ (Nov 10)
- Query Optimization on 1 query

# Team contributions Phase 3

Lucas:
- Created routes for project, institution, and department. This included many joins to link data accross all the tables
- Created functions to gather counts on researcher projects
- Created UI for Dashboard, Connections, FAQ, Settings, Data Collection, and Institution
- Added local storage system for favoriting researchers, including recommendation system to partially match strings from favorite researchers to get recommendations
- Added concurrency control and locking to the backend by locking rows that were being actively altered and adding transactions to all routes
- Unit tests to ensure correct concurrency control and locking
- Created a baseline react and flask app

## How Concurrency Control Works in CollabConnect

To protect against any race conditions, I added concurrency control and locking to our backend. The setup to do so was very straight forward. 
Here is an example of how concurrency control was added
```
 
    IF p_department_id IS NOT NULL THEN
        SELECT COUNT(*) INTO dept_count
        FROM Department
        WHERE department_id = p_department_id
        FOR UPDATE; -- this will lock the row with p_department_id

        -- This is just for error handling, ensuring the dept_id exists. If you don't, procedures can return 200, even when nothing happened
        IF dept_count = 0 THEN
            SIGNAL SQLSTATE '45000'
            SET MESSAGE_TEXT = 'Department not found';
        END IF;
    END IF;
```

The key here is `FOR UPDATE`. This line will lock the row associated with `p_department_id` so if any other transaction tries to access the same row, 
it will be forced to wait until the current transaction is complete. This prevents any race conditions in the case when multiple people try to alter the
same row. This same pattern in the procedures is found for every one that alters the data in some way. 

In the flask backend, there are two subtle changes. `cursor.execute("START TRANSACTION")` is used at the beginning of every route. Each route also contains a rollback 
and a commit. The one that gets fired depends on the outcome of the called procedure/sql query. These commits and rollbacks are doing like so

```
mysql.connection.commit() # if the sql had no errors

mysql.connection.rollback() # if there was a error with the sql
```

Commit and rollback will automatically free up any locks placed during a transaction. This summarizes the concurrency control in CollabConnect, any further questions
can be directed to lucas.matheson@maine.edu


Abbas: 
- Created routes for project, project_tag, and tag endpoints so you can use their procedures. The tag entity was removed from the database so the route for it is not necessary. 
- I created a backend logger that logs when a user preforms any action related to the routes we have. 
- Created a project search page and project page for the frontend.
- Created installation and API document
---

## Logging System & ACID Compliance

### Overview
CollabConnect implements a comprehensive logging system that tracks all user actions, errors, and system events. The logger is critical for audit trails, debugging, and maintaining ACID compliance through transaction documentation.

### Implementation

**Location:** `Backend/utils/logger.py` → logs to `Backend/logs/app.log`

**Core Functions:**
- `log_info(message)` - Log successful operations
- `log_error(message)` - Log errors with context
- `get_request_user()` - Extract user ID from JWT token, format as `[User: ID]` or `[anonymous]`

**Configuration:**
- RotatingFileHandler: 10 MB max per file, keeps 10 backups
- All logs include timestamp, user ID, operation type, and outcome
- Applied to all 8 route files (auth, user, project, person, department, institution, tag, project_tag)

### Example Log Format
```
2025-12-07 15:45:23 - CollabConnect - INFO - [User: 42] Fetching all projects (count=333)
2025-12-07 15:45:24 - CollabConnect - ERROR - [User: 42] Unauthorized: Cannot delete project owned by User: 50
```

### ACID Compliance Through Logging

| ACID Property | How Logging Ensures It |
|---|---|
| **Atomicity** | Logs all steps; missing completion log = transaction failed/rolled back |
| **Consistency** | Logs constraint violations (e.g., duplicate profile claims, invalid operations) |
| **Isolation** | User-prefixed logs track concurrent operations; database locks prevent conflicts |
| **Durability** | RotatingFileHandler persists logs to disk immediately; survives server crashes |

### Transaction Management

- **User Context:** Every operation logged with authenticated user ID for accountability
- **Error Context:** Failed operations logged with full details (user, operation, error message)
- **Audit Trail:** Complete record of who did what, when, and the outcome
- **Recovery:** On restart, logs show incomplete transactions that need rollback

### Benefits

1. **Accountability** - All actions traced to user
2. **Debugging** - Complete operation history
3. **Compliance** - Regulatory audit trail
4. **Security** - Detect unauthorized attempts
5. **Integrity** - Verify ACID properties hold across failures

Wyatt McCurdy (Advanced Feature):
- Built the analytics collaboration network (backend + frontend) with community detection, metrics, and caching.
- Backend endpoint `/api/analytics/network` (NetworkX) returns nodes, edges, and statistics (degree, density, collaborators, projects).
- Frontend ReactFlow view at `/analytics` with selectable nodes, edge highlighting, isolated-toggle, refresh, and stats chips.
- Visualizes a network of potential collaborators connected through shared projects, so you can see who has worked together and explore collaboration clusters at a glance.

Aubin: 
- Advanced database feature – database security:
  - Designed the authentication system, including secure routes for register and login. 
  - Added secure password hashing and implemented email verification codes with 15-minute expiry.
  - Updated the User table and created stored procedures for registration, email verification, resend-code, and last_login tracking.
  - Added strong input validation and transaction handling to prevent invalid or partial writes.

- Other contributions:
  - Implemented backend routes and built the frontend department page.
  - Created user-facing features to add and edit projects.
  - Implemented account management options (edit and delete account).
  - Set up the email sender feature for verification, welcome emails, and resend-code flows.
  - Built pages for register, login, and the 6-digit email verification workflow.
  - Connected all frontend authentication pages to the backend authentication API.
  - Added the ability for users to claim scraped researcher profiles or create a new profile from scratch.



