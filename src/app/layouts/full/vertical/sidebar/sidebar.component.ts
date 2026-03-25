import { Component, EventEmitter, Input, OnInit, Output } from '@angular/core';
import { TablerIconsModule } from 'angular-tabler-icons';
import { MaterialModule } from 'src/app/material.module';
import { AuthenticationService } from 'src/app/services/auth.service';

@Component({
  selector: 'app-sidebar',
  imports: [TablerIconsModule, MaterialModule],
  templateUrl: './sidebar.component.html',
})
export class SidebarComponent implements OnInit {
  public showNombre: any;
  public showApellidoPaterno: any;
  public showApellidoMaterno: any;
  public showImage: any;
  constructor(private users: AuthenticationService,) {
    const user = this.users.getUser();
    this.showNombre = user?.nombre;
    this.showApellidoPaterno = user?.apellidoPaterno || '';
    this.showApellidoMaterno = user?.apellidoMaterno || '';
    if(user?.fotoPerfil == 'null' || user?.fotoPerfil == null){
      this.showImage = 'https://analitica-video.s3.us-east-1.amazonaws.com/Usuarios/user.png'
    } else{
      this.showImage = user?.fotoPerfil
    }
  }
  @Input() showToggle = true;
  @Output() toggleMobileNav = new EventEmitter<void>();
  @Output() toggleCollapsed = new EventEmitter<void>();

  ngOnInit(): void {}
}
