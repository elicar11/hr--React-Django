from rest_framework.permissions import SAFE_METHODS, BasePermission

from .models import Role


class HasRole(BasePermission):
    """Grants access only to active, authenticated users holding an allowed role."""

    allowed_roles: frozenset = frozenset()
    message = "Vous n'avez pas les droits nécessaires pour cette opération."

    def has_permission(self, request, view):
        user = request.user
        return bool(
            user
            and user.is_authenticated
            and user.is_active
            and user.role in self.allowed_roles
        )


def role_permission(*roles):
    """Build a permission class for the given roles."""
    return type("RolePermission", (HasRole,), {"allowed_roles": frozenset(roles)})


# Reusable permission classes for every module.
IsAdmin = role_permission(Role.ADMIN)
IsAdminOrHR = role_permission(Role.ADMIN, Role.HR)


class IsAdminOrHROrReadOnly(BasePermission):
    """Any active authenticated user can read; only ADMIN and HR can write."""

    message = "Vous n'avez pas les droits nécessaires pour cette opération."

    def has_permission(self, request, view):
        user = request.user
        if not (user and user.is_authenticated and user.is_active):
            return False
        if request.method in SAFE_METHODS:
            return True
        return user.role in (Role.ADMIN, Role.HR)