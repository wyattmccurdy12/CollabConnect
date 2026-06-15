"""
Author: Aubin Mugisha
Date: December 1, 2025

JWT token utilities for authentication and authorization.
Handles token generation, validation, and route protection.
"""

import jwt
import os
from datetime import datetime, timedelta, timezone
from functools import wraps
from flask import request, jsonify

SECRET_KEY = os.environ.get("JWT_SECRET")
if not SECRET_KEY:
    raise RuntimeError("JWT_SECRET environment variable must be set")
TOKEN_EXPIRY_HOURS = 24

def generate_access_token(user_id, email, person_id=None):
    """Generate JWT token with user info that expires in 24 hours"""
    now = datetime.now(timezone.utc)
    payload = {
        'user_id': user_id,
        'email': email,
        'exp': now + timedelta(hours=TOKEN_EXPIRY_HOURS),
        'iat': now
    }
    if person_id:
        payload['person_id'] = person_id
    return jwt.encode(payload, SECRET_KEY, algorithm='HS256')


def decode_access_token(token):
    """Decode and validate JWT token, returns payload or None if invalid"""
    try:
        return jwt.decode(token, SECRET_KEY, algorithms=['HS256'])
    except:
        return None

def token_required(f):
    """Decorator to protect routes - validates JWT token from Authorization header"""
    @wraps(f)
    def decorated(*args, **kwargs):
        token = None
        
        # Extract token
        if 'Authorization' in request.headers:
            try:
                token = request.headers['Authorization'].split(' ')[1]
            except:
                return jsonify({'status': 'error', 'message': 'Invalid token format'}), 401
        
        if not token:
            return jsonify({'status': 'error', 'message': 'Token missing'}), 401
        
        # Decode and validate token
        payload = decode_access_token(token)
        if not payload:
            return jsonify({'status': 'error', 'message': 'Invalid token'}), 401
        
        # Attach user info to request for use in route
        request.current_user = payload
        return f(*args, **kwargs)
    
    return decorated
