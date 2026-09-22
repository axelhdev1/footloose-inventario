import {
  BadRequestException,
  Controller,
  Post,
  UploadedFile,
  UseInterceptors,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { InventarioService } from './inventario.service';
import { ReporteCarga } from './inventario.types';

@Controller('inventario')
export class InventarioController {
  constructor(private readonly inventarioService: InventarioService) {}

  // POST /api/inventario/upload  (campo form-data: "file")
  @Post('upload')
  @UseInterceptors(FileInterceptor('file', { limits: { fileSize: 10 * 1024 * 1024 } }))
  async upload(@UploadedFile() file: Express.Multer.File): Promise<ReporteCarga> {
    if (!file) {
      throw new BadRequestException('Debe enviar un archivo en el campo "file".');
    }
    if (!file.originalname.toLowerCase().endsWith('.xlsx')) {
      throw new BadRequestException('El archivo debe tener formato .xlsx');
    }
    return this.inventarioService.procesarArchivo(file.buffer);
  }
}
