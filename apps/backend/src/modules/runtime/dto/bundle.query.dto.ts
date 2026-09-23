import { Transform } from 'class-transformer';
import { IsBoolean, IsOptional } from 'class-validator';

export class BundleQueryDto {
  /**
   * Whether global namespaces are merged into the bundle. Defaults to **true**:
   * a client that asks for its copy wants all of it, and a global module exists
   * precisely to be shared.
   *
   * Transformed by hand because `enableImplicitConversion` is off globally — it
   * coerces in surprising places, most famously turning the string `'false'`
   * into `true`, which is exactly the bug that would matter here.
   */
  @IsOptional()
  @Transform(({ value }) => value !== 'false' && value !== false)
  @IsBoolean()
  includeGlobal: boolean = true;
}
