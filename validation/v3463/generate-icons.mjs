import {readFileSync,writeFileSync} from 'node:fs';
import {transparentOfficialIcon} from './app-identity.mjs';
for(const size of [192,512])writeFileSync('raytech-app-'+size+'.png',transparentOfficialIcon(readFileSync('raytech-icon-'+size+'.png')));
