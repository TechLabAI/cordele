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
import { ProjEntity } from '../../domain/proj.entity';
import { CreateProjDto } from './dto/create-proj.dto';
import { UpdateProjDto } from './dto/update-proj.dto';
import { ProjService } from './proj.service';

/**
 * HTTP adapter for the PROJ (PROJ) bounded context.
 *
 * Controllers stay thin: validate (via the global ValidationPipe + DTOs),
 * delegate to the application service, and shape the HTTP response. No
 * business rule lives here.
 */
@ApiTags('proj')
@ApiBearerAuth('bearer')
@UseGuards(JwtAuthGuard)
@Controller({ path: 'proj', version: '1' })
export class ProjController {
  constructor(private readonly projService: ProjService) {}

  @Post()
  @ApiOperation({ summary: 'Create a new proj record' })
  @ApiCreatedResponse({ description: 'The proj record was created.' })
  create(
    @Body() dto: CreateProjDto,
    @CurrentUser() user: AuthenticatedUser,
  ): Promise<ProjEntity> {
    return this.projService.create(dto, user);
  }

  @Get()
  @ApiOperation({ summary: 'List proj records' })
  @ApiOkResponse({ description: 'Paginated proj records.' })
  findAll(
    @CurrentUser() user: AuthenticatedUser,
    @Query('page') page = 1,
    @Query('size') size = 20,
  ): Promise<{ items: ProjEntity[]; total: number }> {
    return this.projService.findAll(user, { page: Number(page), size: Number(size) });
  }

  @Get(':id')
  @ApiOperation({ summary: 'Get a single proj record by id' })
  @ApiOkResponse({ description: 'The requested proj record.' })
  findOne(
    @Param('id', ParseUUIDPipe) id: string,
    @CurrentUser() user: AuthenticatedUser,
  ): Promise<ProjEntity> {
    return this.projService.findOne(id, user);
  }

  @Patch(':id')
  @ApiOperation({ summary: 'Partially update a proj record' })
  @ApiOkResponse({ description: 'The updated proj record.' })
  update(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: UpdateProjDto,
    @CurrentUser() user: AuthenticatedUser,
  ): Promise<ProjEntity> {
    return this.projService.update(id, dto, user);
  }

  @Delete(':id')
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({ summary: 'Delete a proj record' })
  @ApiNoContentResponse({ description: 'The proj record was deleted.' })
  remove(
    @Param('id', ParseUUIDPipe) id: string,
    @CurrentUser() user: AuthenticatedUser,
  ): Promise<void> {
    return this.projService.remove(id, user);
  }
}
