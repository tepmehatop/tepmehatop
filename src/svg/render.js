// SSR entry: Svelte components → standalone SVG strings.
import { render } from 'svelte/server';
import Banner from './Banner.svelte';
import BugHunt from './BugHunt.svelte';
import GameCard from './GameCard.svelte';

function toSvg(Component, props) {
  const { body } = render(Component, { props });
  return body
    .replace(/<!--[\s\S]*?-->/g, '') // hydration markers are noise in a static file
    .replace(/>\s+</g, '><')
    .trim();
}

export const renderBanner = (props) => toSvg(Banner, props);
export const renderBugHunt = (props) => toSvg(BugHunt, props);
export const renderGameCard = (props) => toSvg(GameCard, props);
