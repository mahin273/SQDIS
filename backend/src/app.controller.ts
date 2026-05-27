import { Controller, Get } from '@nestjs/common';
import { AppService } from './app.service.js';
import { ApiTags, ApiOperation, ApiResponse } from '@nestjs/swagger';

@ApiTags('App')
@Controller()
export class AppController {
  constructor(private readonly appService: AppService) {}

  @Get()
  @ApiOperation({ summary: 'Get hello message' })
  @ApiResponse({ status: 200, description: 'Hello message retrieved successfully.', type: String })
  getHello(): string {
    return this.appService.getHello();
  }
}
