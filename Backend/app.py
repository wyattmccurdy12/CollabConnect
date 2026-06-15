from flask import Flask
from flask_cors import CORS
from flask_mysqldb import MySQL
import os
import configparser
from routes.institution_routes import institution_bp
from routes.project_routes import project_bp
from routes.person_routes import person_bp
from routes.tag_routes import tags_bp
from routes.project_tag_routes import project_tag_bp
from routes.department_routes import department_bp
from routes.auth_routes import auth_bp
from routes.user_routes import user_bp
from routes.analytics_routes import analytics_bp
"""
Filename: app.py
Author: Lucas Matheson
Edited by: Lucas Matheson
Date: November 10, 2025

This app.py file is the file that will be used to start the flask
application for collabconnect. It will be the heart of the backend. 

All config settings are read from config.ini, which is not pushed
into the repo. This however may change.

Using MySql and MySql Workbench, this app.py file defines the database,
ensures it exists before starting the application, and runs the flask app.
All default routes, such as health, are defined here. 
"""


app = Flask(__name__)
allowed_origins = os.environ.get("CORS_ORIGINS", "http://localhost:3000")
if isinstance(allowed_origins, str):
    allowed_origins = [origin.strip() for origin in allowed_origins.split(",") if origin.strip()]
CORS(app, origins=allowed_origins)

config = configparser.ConfigParser()
config_path = os.path.join(os.path.dirname(__file__), "config.ini")
config.read(config_path)


def _config_value(section, option, fallback=None):
    env_map = {
        ("Database", "db_host"): "MYSQL_HOST",
        ("Database", "db_port"): "MYSQL_PORT",
        ("Database", "db_user"): "MYSQL_USER",
        ("Database", "db_password"): "MYSQL_PASSWORD",
        ("Database", "db_name"): "MYSQL_DB",
    }
    env_key = env_map.get((section, option))
    if env_key and env_key in os.environ:
        return os.environ[env_key]
    if section in config and option in config[section]:
        return config.get(section, option, fallback=fallback)
    return fallback

app.config["MYSQL_HOST"] = _config_value("Database", "db_host", fallback="127.0.0.1")
app.config["MYSQL_PORT"] = int(_config_value("Database", "db_port", fallback=3306))
app.config["MYSQL_USER"] = _config_value("Database", "db_user", fallback="root")
app.config["MYSQL_PASSWORD"] = _config_value("Database", "db_password", fallback="")
app.config["MYSQL_DB"] = _config_value("Database", "db_name", fallback="collab_connect_db")
app.config["MYSQL_CURSORCLASS"] = config.get(
    "Database", "db_cursorclass", fallback="DictCursor"
)

app.config["HOST"] = os.environ.get("HOST", "0.0.0.0")
app.config["PORT"] = int(os.environ.get("PORT", "5001"))
app.config["DEBUG"] = os.environ.get("FLASK_DEBUG", str(config.getboolean("General", "debug", fallback=True))).lower() in ("1", "true", "yes", "on")

mysql = MySQL(app)

# Define your routes here
app.register_blueprint(institution_bp)
app.register_blueprint(project_bp)
app.register_blueprint(person_bp)
app.register_blueprint(tags_bp)
app.register_blueprint(project_tag_bp)
app.register_blueprint(department_bp)
app.register_blueprint(auth_bp)
app.register_blueprint(user_bp)
app.register_blueprint(analytics_bp)


@app.route("/health")
def health():
    cursor = mysql.connection.cursor()
    cursor.execute(
        """
        SELECT TABLE_NAME
        FROM INFORMATION_SCHEMA.TABLES
        WHERE TABLE_SCHEMA = 'collab_connect_db';
    """
    )

    tables = cursor.fetchall()
    output = []

    for t in tables:
        output.append(t["TABLE_NAME"])

    cursor.close()

    #  On the page, it will print this and all the tables, seperated by commas
    return f'Connected to MySQL! Current tables: {", ".join(output)}'


if __name__ == "__main__":
    app.run(host=app.config["HOST"], port=app.config["PORT"], debug=app.config["DEBUG"])
