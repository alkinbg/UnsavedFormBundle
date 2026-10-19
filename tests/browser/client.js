import * as Turbo from '@hotwired/turbo';
import { Application } from '@hotwired/stimulus';
import Guard from '../../assets/dist/controller.js';

const application = Application.start();
application.register('guard', Guard);
window.application = application;
window.Turbo = Turbo;
