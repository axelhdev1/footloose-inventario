import { Component, inject } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { JsonPipe } from '@angular/common';

@Component({
  selector: 'app-root',
  standalone: true,
  imports: [JsonPipe],
  template: `
    <main class="contenedor">
      <section class="card">
        <h1>Carga de inventario</h1>
        <p class="sub">Selecciona un archivo .xlsx para actualizar los productos.</p>

        <div class="acciones">
          <label class="archivo">
            <input type="file" accept=".xlsx" (change)="seleccionar($event)" />
            <span>{{ archivo ? archivo.name : 'Seleccionar archivo' }}</span>
          </label>
          <button (click)="subir()" [disabled]="!archivo || cargando">
            {{ cargando ? 'Subiendo...' : 'Subir' }}
          </button>
        </div>

        @if (error) {
          <p class="error">{{ error }}</p>
        }
        @if (resultado) {
          <pre class="resultado">{{ resultado | json }}</pre>
        }
      </section>
    </main>
  `,
  styles: [`
    .contenedor { min-height: 100vh; display: flex; justify-content: center; align-items: flex-start;
      padding: 48px 16px; background: #f3f4f6; font-family: Arial, sans-serif; box-sizing: border-box; }
    .card { width: 100%; max-width: 640px; background: #fff; border-radius: 8px; padding: 24px;
      box-shadow: 0 1px 4px rgba(0,0,0,.1); }
    h1 { margin: 0 0 4px; font-size: 22px; color: #222; }
    .sub { margin: 0 0 20px; color: #666; font-size: 14px; }
    .acciones { display: flex; gap: 12px; flex-wrap: wrap; }
    .archivo { flex: 1; min-width: 200px; border: 1px dashed #999; border-radius: 6px; padding: 10px 12px;
      cursor: pointer; color: #444; font-size: 14px; overflow: hidden; white-space: nowrap; text-overflow: ellipsis; }
    .archivo input { display: none; }
    button { background: #4b2a85; color: #fff; border: none; border-radius: 6px; padding: 10px 24px;
      font-size: 14px; cursor: pointer; }
    button:disabled { background: #aaa; cursor: not-allowed; }
    .error { margin-top: 16px; color: #b00020; font-size: 14px; }
    .resultado { margin-top: 16px; background: #1e1e1e; color: #d4d4d4; padding: 16px; border-radius: 6px;
      font-size: 13px; overflow: auto; max-height: 420px; }
  `],
})
export class App {
  private http = inject(HttpClient);
  private readonly apiUrl = 'http://localhost:3000/api/inventario/upload';

  archivo: File | null = null;
  resultado: unknown = null;
  error = '';
  cargando = false;

  seleccionar(event: Event) {
    const input = event.target as HTMLInputElement;
    this.archivo = input.files?.[0] ?? null;
    this.error = '';
  }

  subir() {
    if (!this.archivo) {
      this.error = 'Selecciona un archivo .xlsx';
      return;
    }
    const formData = new FormData();
    formData.append('file', this.archivo);

    this.cargando = true;
    this.error = '';
    this.resultado = null;

    this.http.post(this.apiUrl, formData).subscribe({
      next: (res) => {
        this.resultado = res;
        this.cargando = false;
      },
      error: (err) => {
        this.error = err.error?.message ?? 'Error al subir el archivo';
        this.cargando = false;
      },
    });
  }
}

