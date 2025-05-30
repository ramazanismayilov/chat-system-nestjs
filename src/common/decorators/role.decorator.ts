import { SetMetadata } from "@nestjs/common";
import { UserRole } from "../enums/role.enum";

export const Role = (...roles: UserRole[]) => {
    return SetMetadata("roles", roles)
}