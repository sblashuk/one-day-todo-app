import re

from sqlalchemy import select
from werkzeug.security import check_password_hash, generate_password_hash

from ..extensions import db
from ..models import User

EMAIL_PATTERN = re.compile(r"^[^@\s]+@[^@\s]+\.[^@\s]+$")


class CredentialsValidationError(Exception):
    def __init__(self, fields: dict[str, str]) -> None:
        super().__init__("Invalid credentials fields")
        self.fields = fields


class EmailExistsError(Exception):
    pass


class InvalidCredentialsError(Exception):
    pass


def get_user(user_id: int) -> User | None:
    return db.session.get(User, user_id)


def register_user(raw_email: object, raw_password: object) -> User:
    email, password = _validated_credentials(raw_email, raw_password)
    existing = db.session.scalar(select(User).where(User.email == email))
    if existing:
        raise EmailExistsError

    user = User(email=email, password_hash=generate_password_hash(password))
    db.session.add(user)
    db.session.commit()
    return user


def authenticate_user(raw_email: object, raw_password: object) -> User:
    email, password = _validated_credentials(raw_email, raw_password)
    user = db.session.scalar(select(User).where(User.email == email))
    if user is None or not check_password_hash(user.password_hash, password):
        raise InvalidCredentialsError
    return user


def _validated_credentials(raw_email: object, raw_password: object) -> tuple[str, str]:
    email = raw_email.strip().lower() if isinstance(raw_email, str) else ""
    password = raw_password if isinstance(raw_password, str) else ""
    fields: dict[str, str] = {}
    if not email or len(email) > 320 or not EMAIL_PATTERN.fullmatch(email):
        fields["email"] = "Enter a valid email address."
    if not isinstance(raw_password, str) or not 8 <= len(password) <= 128:
        fields["password"] = "Password must be 8–128 characters."
    if fields:
        raise CredentialsValidationError(fields)
    return email, password
