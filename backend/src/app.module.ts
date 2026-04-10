import { Module } from '@nestjs/common';
import { AppController } from './app.controller.js';
import { AppService } from './app.service.js';
import { OrganizationsModule } from './modules/organizations/organizations.module.js';

/**
 * Root Application Module
 * Registers all feature modules
 */
@Module({
  imports: [OrganizationsModule],
  controllers: [AppController],
  providers: [AppService],
})
export class AppModule {}