import { Injectable } from '@nestjs/common';
import { PrismaService } from './prisma.service';

@Injectable()
export class AuditService {
  constructor(private prisma: PrismaService) {}

  async log(username: string, role: string, action: string, quotationNo?: string) {
    return this.prisma.auditLog.create({
      data: {
        username: username || 'System',
        role: role || 'Unknown',
        action,
        quotation_no: quotationNo,
      },
    });
  }
}
