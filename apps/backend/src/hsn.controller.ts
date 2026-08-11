import { Controller, Get, UseGuards } from '@nestjs/common';
import { HsnService, BackendHsnCode } from './hsn.service';
import { RolesGuard } from './roles.guard';

@Controller('api/hsn-codes')
@UseGuards(RolesGuard)
export class HsnController {
  constructor(private readonly hsnService: HsnService) {}

  @Get()
  getHsnCodes(): BackendHsnCode[] {
    return this.hsnService.getHsnCodes();
  }
}
