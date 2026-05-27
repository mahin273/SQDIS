import { Module, forwardRef } from '@nestjs/common';
import { ReviewsController } from './reviews.controller';
import { ReviewsService } from './reviews.service';
import { ReviewProcessor, ReviewCommentProcessor, PullRequestProcessor } from './processors';
import { PrismaModule } from '../../prisma';
import { AuthModule } from '../auth/auth.module';
import { OrganizationsModule } from '../organizations/organizations.module';
import { ScoresModule } from '../scores/scores.module';
import { OnboardingModule } from '../onboarding/onboarding.module';
import { ReviewQueueModule, ReviewCommentQueueModule, PullRequestQueueModule } from '../../config';

/**
 * Reviews module for processing and tracking code reviews
 */
@Module({
  imports: [
    PrismaModule,
    ReviewQueueModule,
    ReviewCommentQueueModule,
    PullRequestQueueModule,
    forwardRef(() => AuthModule),
    forwardRef(() => OrganizationsModule),
    forwardRef(() => ScoresModule),
    forwardRef(() => OnboardingModule),
  ],
  controllers: [ReviewsController],
  providers: [ReviewsService, ReviewProcessor, ReviewCommentProcessor, PullRequestProcessor],
  exports: [ReviewsService],
})
export class ReviewsModule {}
