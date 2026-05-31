import { Controller, Get, Param } from '@nestjs/common';
import { ScholarsService } from './scholars.service';

@Controller('scholars')
export class ScholarsController {
  constructor(private readonly scholarsService: ScholarsService) {}

  @Get()
  findAll() {
    return this.scholarsService.findAll();
  }

  @Get('books')
  findAllBooks() {
    return this.scholarsService.findAllBooks();
  }

  @Get(':slug')
  findOne(@Param('slug') slug: string) {
    return this.scholarsService.findBySlug(slug);
  }
}
