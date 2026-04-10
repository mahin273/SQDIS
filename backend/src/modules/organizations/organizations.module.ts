import { Module } from '@nestjs/common';
import { OrganizationsController } from './organizations.controller.js';
import { OrganizationsService } from './organizations.service.js';
/**
 * Organizations Module
 * Handles organization creation, member management, and invitations
 */
@Module({
  controllers: [OrganizationsController],
  providers: [OrganizationsService],
  exports: [OrganizationsService], // Export so other modules can use it
})
export class OrganizationsModule {}