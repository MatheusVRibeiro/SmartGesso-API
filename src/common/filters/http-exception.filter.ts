import {
  ArgumentsHost,
  Catch,
  ExceptionFilter,
  HttpException,
  HttpStatus,
  Logger,
} from '@nestjs/common';
@Catch()
export class HttpExceptionFilter implements ExceptionFilter {
  private readonly logger = new Logger('HttpExceptionFilter');

  catch(exception: unknown, host: ArgumentsHost) {
    const res = host.switchToHttp().getResponse();
    const req = host.switchToHttp().getRequest();
    const status =
      exception instanceof HttpException ? exception.getStatus() : HttpStatus.INTERNAL_SERVER_ERROR;

    // Loga o erro real (stack) para diagnóstico — nunca expõe ao cliente.
    if (!(exception instanceof HttpException) || status >= 500) {
      this.logger.error(
        `${req.method} ${req.url} → ${status}`,
        exception instanceof Error ? (exception.stack ?? exception.message) : String(exception),
      );
    }

    const body =
      exception instanceof HttpException ? exception.getResponse() : { message: 'Erro interno' };
    res
      .status(status)
      .json(
        typeof body === 'object'
          ? { statusCode: status, path: req.url, ...body }
          : { statusCode: status, message: body, path: req.url },
      );
  }
}
