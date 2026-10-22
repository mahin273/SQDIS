import { Module, OnModuleInit, forwardRef } from '@nestjs/common';
import { BullModule, InjectQueue } from '@nestjs/bullmq';
import { Queue } from 'bullmq';
import { createBullBoard } from '@bull-board/api';
import { BullMQAdapter } from '@bull-board/api/bullMQAdapter';
import { ExpressAdapter } from '@bull-board/express';
import { HttpAdapterHost } from '@nestjs/core';
import { ConfigModule } from '@nestjs/config';
import { AuthModule } from '../auth/auth.module';
import { BullBoardAuthMiddleware } from './bull-board-auth.middleware';
import {
  SCORE_QUEUE,
  COMMIT_QUEUE,
  REVIEW_QUEUE,
  REVIEW_COMMENT_QUEUE,
  REPORT_QUEUE,
} from '../../config';

@Module({
  imports: [
    BullModule.registerQueue(
      { name: SCORE_QUEUE },
      { name: COMMIT_QUEUE },
      { name: REVIEW_QUEUE },
      { name: REVIEW_COMMENT_QUEUE },
      { name: REPORT_QUEUE },
    ),
    ConfigModule,
    forwardRef(() => AuthModule),
  ],
  providers: [BullBoardAuthMiddleware],
  exports: [BullBoardAuthMiddleware],
})
export class BullBoardConfigModule implements OnModuleInit {
  constructor(
    private readonly httpAdapterHost: HttpAdapterHost,
    private readonly authMiddleware: BullBoardAuthMiddleware,
    @InjectQueue(SCORE_QUEUE) private readonly scoreQueue: Queue,
    @InjectQueue(COMMIT_QUEUE) private readonly commitQueue: Queue,
    @InjectQueue(REVIEW_QUEUE) private readonly reviewQueue: Queue,
    @InjectQueue(REVIEW_COMMENT_QUEUE) private readonly reviewCommentQueue: Queue,
    @InjectQueue(REPORT_QUEUE) private readonly reportQueue: Queue,
  ) {}

  onModuleInit() {
    const serverAdapter = new ExpressAdapter();
    serverAdapter.setBasePath('/api/queues');

    createBullBoard({
      queues: [
        new BullMQAdapter(this.scoreQueue),
        new BullMQAdapter(this.commitQueue),
        new BullMQAdapter(this.reviewQueue),
        new BullMQAdapter(this.reviewCommentQueue),
        new BullMQAdapter(this.reportQueue),
      ],
      serverAdapter,
    });

    const httpAdapter = this.httpAdapterHost?.httpAdapter;
    if (httpAdapter) {
      const app = httpAdapter.getInstance();
      if (app && typeof app.use === 'function') {
        app.use(
          '/api/queues',
          (req: any, res: any, next: any) => this.authMiddleware.use(req, res, next),
          serverAdapter.getRouter(),
        );
      }
    }
  }
}
