import { IsBoolean } from 'class-validator';

/** DTO para criar/atualizar um override de feature da empresa (ETAPA 13). */
export class UpdateFeatureOverrideDto {
  @IsBoolean()
  enabled!: boolean;
}
