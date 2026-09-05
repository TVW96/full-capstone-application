import { CanActivate, ExecutionContext, Injectable } from "@nestjs/common";
import type { Request } from "express";
import { UsersService } from "../users/users.service";

@Injectable()
export class SellingAuthGuard implements CanActivate {
  constructor(private readonly users: UsersService) {}
  async canActivate(context: ExecutionContext): Promise<boolean> {
    const request = context.switchToHttp().getRequest<Request>();
    await this.users.requireAuthenticatedUser(
      request.headers.authorization?.replace(/^Bearer\s+/i, "").trim() ?? "",
    );
    return true;
  }
}
