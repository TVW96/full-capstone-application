import {
  BadRequestException,
  Controller,
  Delete,
  Headers,
  Post,
  UploadedFile,
  UseInterceptors,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';

import {
  AVATAR_MAX_BYTES,
  type AvatarUpload,
  MediaService,
} from './media.service';

@Controller('users/me/avatar')
export class MediaController {
  constructor(private readonly mediaService: MediaService) {}

  @Post()
  @UseInterceptors(
    FileInterceptor('avatar', {
      limits: { fileSize: AVATAR_MAX_BYTES, files: 1 },
    }),
  )
  uploadAvatar(
    @Headers('authorization') authorization: string | undefined,
    @UploadedFile() file?: AvatarUpload,
  ) {
    if (!file) throw new BadRequestException('Choose an image to upload.');
    return this.mediaService.uploadAvatar(
      this.getBearerToken(authorization),
      file,
    );
  }

  @Delete()
  removeAvatar(@Headers('authorization') authorization?: string) {
    return this.mediaService.removeAvatar(this.getBearerToken(authorization));
  }

  private getBearerToken(authorization?: string): string {
    return authorization?.replace(/^Bearer\s+/i, '').trim() ?? '';
  }
}
