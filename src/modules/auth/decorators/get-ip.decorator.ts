import { createParamDecorator, ExecutionContext } from '@nestjs/common';

export const GetRealIP = createParamDecorator(
  (data: unknown, ctx: ExecutionContext) => {
    const request = ctx.switchToHttp().getRequest();
    const xForwardedFor = request.headers['x-forwarded-for'];

    if (xForwardedFor) {
      return typeof xForwardedFor === 'string'
        ? xForwardedFor.split(',')[0]
        : xForwardedFor[0];
    }

    return request.ip || request.connection.remoteAddress;
  },
);
