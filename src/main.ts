import './style.css';
import { Game } from './game/Game';

const scoreEl = document.getElementById('score');
const statusEl = document.getElementById('status');

const game = new Game(scoreEl, statusEl);
game.start();
