import { Injectable, ExecutionContext } from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';

/**
 * GitHub OAuth Guard for initiating and handling GitHub authentication
 */
@Injectable()
export class GitHubAuthGuard extends AuthGuard('github') {
  async canActivate(context: ExecutionContext): Promise<boolean> {
    const req = context.switchToHttp().getRequest();
    // If request contains a signed state parameter (dot-separated), it is an organization integration callback
    if (req.query?.state && typeof req.query.state === 'string' && req.query.state.includes('.')) {
      return true;
    }

    const result = (await super.canActivate(context)) as boolean;
    return result;
  }
}
