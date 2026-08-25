import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  ParseUUIDPipe,
  Patch,
  Post,
  Query,
  UseGuards,
} from '@nestjs/common';
import {
  ApiBearerAuth,
  ApiNoContentResponse,
  ApiOkResponse,
  ApiOperation,
  ApiCreatedResponse,
  ApiTags,
} from '@nestjs/swagger';

import {
  CurrentUser,
  JwtAuthGuard,
  type AuthenticatedUser,
} from '../../infrastructure/auth/jwt-auth.guard';
import { PubEntity } from '../../domain/pub.entity';
import { CreatePubDto } from './dto/create-pub.dto';
import { UpdatePubDto } from './dto/update-pub.dto';
import { PubService } from './pub.service';

/**
 * HTTP adapter for the PUB (PUB) bounded context.
 *
 * Controllers stay thin: validate (via the global ValidationPipe + DTOs),
 * delegate to the application service, and shape the HTTP response. No
 * business rule lives here.
 */
@ApiTags('pub')
@ApiBearerAuth('bearer')
@UseGuards(JwtAuthGuard)
@Controller({ path: 'pub', version: '1' })
export class PubController {
  constructor(private readonly pubService: PubService) {}

  @Post()
  @ApiOperation({ summary: 'Create a new pub record' })
  @ApiCreatedResponse({ description: 'The pub record was created.' })
  create(
    @Body() dto: CreatePubDto,
    @CurrentUser() user: AuthenticatedUser,
  ): Promise<PubEntity> {
    return this.pubService.create(dto, user);
  }

  @Get()
  @ApiOperation({ summary: 'List pub records' })
  @ApiOkResponse({ description: 'Paginated pub records.' })
  findAll(
    @CurrentUser() user: AuthenticatedUser,
    @Query('page') page = 1,
    @Query('size') size = 20,
  ): Promise<{ items: PubEntity[]; total: number }> {
    return this.pubService.findAll(user, { page: Number(page), size: Number(size) });
  }

  @Get(':id')
  @ApiOperation({ summary: 'Get a single pub record by id' })
  @ApiOkResponse({ description: 'The requested pub record.' })
  findOne(
    @Param('id', ParseUUIDPipe) id: string,
    @CurrentUser() user: AuthenticatedUser,
  ): Promise<PubEntity> {
    return this.pubService.findOne(id, user);
  }

  @Patch(':id')
  @ApiOperation({ summary: 'Partially update a pub record' })
  @ApiOkResponse({ description: 'The updated pub record.' })
  update(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: UpdatePubDto,
    @CurrentUser() user: AuthenticatedUser,
  ): Promise<PubEntity> {
    return this.pubService.update(id, dto, user);
  }

  @Delete(':id')
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({ summary: 'Delete a pub record' })
  @ApiNoContentResponse({ description: 'The pub record was deleted.' })
  remove(
    @Param('id', ParseUUIDPipe) id: string,
    @CurrentUser() user: AuthenticatedUser,
  ): Promise<void> {
    return this.pubService.remove(id, user);
  }
}
