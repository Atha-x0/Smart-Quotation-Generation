import { Injectable, CanActivate, ExecutionContext, SetMetadata } from '@nestjs/common';
import { Reflector } from '@nestjs/core';

export const Roles = (...roles: string[]) => SetMetadata('roles', roles);

@Injectable()
export class RolesGuard implements CanActivate {
  constructor(private reflector: Reflector) {}

  canActivate(context: ExecutionContext): boolean {
    const requiredRoles = this.reflector.getAllAndOverride<string[]>('roles', [
      context.getHandler(),
      context.getClass(),
    ]);

    // If no roles are explicitly required, we still deny Viewer role from write operations (POST, PATCH, DELETE) by default
    const request = context.switchToHttp().getRequest();
    const userRole = request.headers['x-user-role'] || 'Viewer';
    const userName = request.headers['x-user-name'] || 'Anonymous';

    // Store user identity on the request object for logging purposes
    request['user'] = { username: userName, role: userRole };

    if (requiredRoles) {
      return requiredRoles.includes(userRole);
    }

    // Default policy: Viewer is read-only (only GET requests allowed)
    if (userRole === 'Viewer' && ['POST', 'PUT', 'PATCH', 'DELETE'].includes(request.method)) {
      return false;
    }

    return true;
  }
}
