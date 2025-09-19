import { NestFactory } from '@nestjs/core';
import { ValidationPipe, Logger } from '@nestjs/common';
import { SwaggerModule, DocumentBuilder } from '@nestjs/swagger';
import { AppModule } from './app.module';

async function bootstrap() {
  const logger = new Logger('Bootstrap');

  const app = await NestFactory.create(AppModule);

  // Enable validation globally with detailed error messages
  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true, // Remove properties that don't have decorators
      forbidNonWhitelisted: true, // Throw error if extra properties are provided
      transform: true, // Automatically transform payloads to DTO instances
      disableErrorMessages: false, // Keep detailed validation messages
    })
  );

  // Enable CORS for web clients
  app.enableCors({
    origin: '*', // In production, specify allowed origins
    methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization'],
  });

  // Setup Swagger API documentation
  const config = new DocumentBuilder()
    .setTitle('OneVote API')
    .setDescription(
      'A RESTful API for creating polls and casting votes with realtime result tracking. '
    )
    .setVersion('1.0')
    .addTag('polls', 'Poll management and voting operations')
    .build();

  const document = SwaggerModule.createDocument(app, config);
  SwaggerModule.setup('docs', app, document, {
    customSiteTitle: 'OneVote API Documentation',
    customCss: '.swagger-ui .topbar { display: none }',
  });

  const port = process.env.PORT || 3000;
  await app.listen(port);

  logger.log(`OneVote API is running on: http://localhost:${port}`);
  logger.log(`API Documentation available at: http://localhost:${port}/docs`);
  logger.log(`Ready to create polls and track votes in real-time!`);
}

bootstrap().catch((error) => {
  const logger = new Logger('Bootstrap');
  logger.error('Failed to start application', error);
  process.exit(1);
});