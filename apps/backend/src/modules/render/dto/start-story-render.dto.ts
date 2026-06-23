// ============================================================
//  apps/backend/src/modules/render/dto/start-story-render.dto.ts
// ============================================================

import { IsOptional, IsIn, IsInt } from 'class-validator'
import { ApiPropertyOptional } from '@nestjs/swagger'

export class StartStoryRenderDto {
  @ApiPropertyOptional({ enum: ['720p', '1080p', '2K', '4K'] })
  @IsOptional() @IsIn(['720p', '1080p', '2K', '4K'])
  resolution?: string

  @ApiPropertyOptional({ enum: [24, 30, 60] })
  @IsOptional() @IsInt() @IsIn([24, 30, 60])
  fps?: number

  @ApiPropertyOptional({ enum: ['mp4', 'mov', 'webm'] })
  @IsOptional() @IsIn(['mp4', 'mov', 'webm'])
  format?: string
}
