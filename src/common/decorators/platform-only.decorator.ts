import { SetMetadata } from '@nestjs/common';
export const PlatformOnly = () => SetMetadata('platformOnly', true);
