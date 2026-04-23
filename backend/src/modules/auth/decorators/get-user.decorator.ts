/* eslint-disable */
import { createParamDecorator, ExecutionContext } from '@nestjs/common';

/**
 * User object attached to request by JWT strategy
 */
export interface RequestUser{
  id:string;
  email:string;
  organizationId?:string;
  role?:string;
}

/**
 * Parameter decorator to extract user from request
 * Usage: @GetUser() user: RequestUser
 * Usage: @GetUser('id') userId: string
 */
export const GetUser = createParamDecorator(
  (data:keyof RequestUser|undefined,ctx:ExecutionContext)=>{
    const request =ctx.switchToHttp().getRequest();
    const user = request.user as RequestUser;
    if(data){
      return user?.[data];
    }
    return user;
  },
);
