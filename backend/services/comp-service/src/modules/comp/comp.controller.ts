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
import { CompEntity } from '../../domain/comp.entity';
import { CreateCompDto } from './dto/create-comp.dto';
import { UpdateCompDto } from './dto/update-comp.dto';
import { CompService } from './comp.service';

/**
 * HTTP adapter for the COMP (COMP) bounded context.
 *
 * Controllers stay thin: validate (via the global ValidationPipe + DTOs),
 * delegate to the application service, and shape the HTTP response. No
 * business rule lives here.
 */
@ApiTags('comp')
@ApiBearerAuth('bearer')
@UseGuards(JwtAuthGuard)
@Controller({ path: 'comp', version: '1' })
export class CompController {
  constructor(private readonly compService: CompService) {}

  @Post()
  @ApiOperation({ summary: 'Create a new comp record' })
  @ApiCreatedResponse({ description: 'The comp record was created.' })
  create(
    @Body() dto: CreateCompDto,
    @CurrentUser() user: AuthenticatedUser,
  ): Promise<CompEntity> {
    return this.compService.create(dto, user);
  }

  @Get()
  @ApiOperation({ summary: 'List comp records' })
  @ApiOkResponse({ description: 'Paginated comp records.' })
  findAll(
    @CurrentUser() user: AuthenticatedUser,
    @Query('page') page = 1,
    @Query('size') size = 20,
  ): Promise<{ items: CompEntity[]; total: number }> {
    return this.compService.findAll(user, { page: Number(page), size: Number(size) });
  }

  @Get(':id')
  @ApiOperation({ summary: 'Get a single comp record by id' })
  @ApiOkResponse({ description: 'The requested comp record.' })
  findOne(
    @Param('id', ParseUUIDPipe) id: string,
    @CurrentUser() user: AuthenticatedUser,
  ): Promise<CompEntity> {
    return this.compService.findOne(id, user);
  }

  @Patch(':id')
  @ApiOperation({ summary: 'Partially update a comp record' })
  @ApiOkResponse({ description: 'The updated comp record.' })
  update(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: UpdateCompDto,
    @CurrentUser() user: AuthenticatedUser,
  ): Promise<CompEntity> {
    return this.compService.update(id, dto, user);
  }

  @Delete(':id')
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({ summary: 'Delete a comp record' })
  @ApiNoContentResponse({ description: 'The comp record was deleted.' })
  remove(
    @Param('id', ParseUUIDPipe) id: string,
    @CurrentUser() user: AuthenticatedUser,
  ): Promise<void> {
    return this.compService.remove(id, user);
  }
}
