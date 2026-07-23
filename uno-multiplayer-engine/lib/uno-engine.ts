export type Color = 'Red' | 'Yellow' | 'Green' | 'Blue' | 'Wild';
export type Value = '0'|'1'|'2'|'3'|'4'|'5'|'6'|'7'|'8'|'9'|'Skip'|'Reverse'|'Draw2'|'Wild'|'WildDraw4';

export interface Card {
  id: string; // Unique ID to help with React rendering
  color: Color;
  value: Value;
}

export interface Player {
  id: string;
  name: string;
  hand: Card[];
  isBot?: boolean;
}

export class UnoGame {
  deck: Card[] = [];
  discardPile: Card[] = [];
  players: Player[] = [];
  currentPlayerIndex: number = 0;
  direction: 1 | -1 = 1;
  activeColor: Color | null = null;
  winner: Player | null = null;
  messages: string[] = [];

  constructor(playerNames: string[]) {
    if (playerNames.length < 1 || playerNames.length > 10) {
      throw new Error("Game requires between 2 and 10 players.");
    }
    this.players = playerNames.map((name, i) => ({
      id: `p${i}`,
      name,
      hand: []
    }));
    this.initializeGame();
  }

  private generateDeck(): Card[] {
    const colors: Color[] = ['Red', 'Yellow', 'Green', 'Blue'];
    const deck: Card[] = [];
    let idCounter = 0;

    colors.forEach(color => {
      deck.push({ id: `c${idCounter++}`, color, value: '0' });
      const values: Value[] = ['1', '2', '3', '4', '5', '6', '7', '8', '9', 'Skip', 'Reverse', 'Draw2'];
      values.forEach(val => {
        deck.push({ id: `c${idCounter++}`, color, value: val });
        deck.push({ id: `c${idCounter++}`, color, value: val });
      });
    });

    for (let i = 0; i < 4; i++) {
      deck.push({ id: `c${idCounter++}`, color: 'Wild', value: 'Wild' });
      deck.push({ id: `c${idCounter++}`, color: 'Wild', value: 'WildDraw4' });
    }

    return deck;
  }

  private shuffle(array: Card[]) {
    for (let i = array.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [array[i], array[j]] = [array[j], array[i]];
    }
  }

  initializeGame() {
    this.deck = this.generateDeck();
    this.shuffle(this.deck);
    this.discardPile = [];
    this.direction = 1;
    this.currentPlayerIndex = 0;
    this.winner = null;
    this.messages = [];

    // Deal 7 cards to each player
    for (let i = 0; i < 7; i++) {
      this.players.forEach(p => {
        p.hand.push(this.drawCard());
      });
    }

    // Flip the first card
    let initialCard = this.drawCard();
    while (initialCard.color === 'Wild' || initialCard.value === 'Skip' || initialCard.value === 'Reverse' || initialCard.value === 'Draw2') {
      // According to official rules, if first card is wild/action, put it back and draw another or apply special rules.
      // For simplicity, we reshuffle it and draw a normal number card.
      this.deck.push(initialCard);
      this.shuffle(this.deck);
      initialCard = this.drawCard();
    }
    
    this.discardPile.push(initialCard);
    this.activeColor = initialCard.color;
    this.log(`Game started. Top card is ${initialCard.color} ${initialCard.value}`);
    this.log(`It's now ${this.players[this.currentPlayerIndex].name}'s turn.`);
  }

  drawCard(): Card {
    if (this.deck.length === 0) {
      if (this.discardPile.length <= 1) {
        throw new Error("No cards left to draw!");
      }
      const top = this.discardPile.pop()!;
      this.deck = [...this.discardPile];
      this.discardPile = [top];
      this.shuffle(this.deck);
      this.log("Deck depleted. Discard pile shuffled into deck.");
    }
    return this.deck.pop()!;
  }

  isValidMove(playedCard: Card, topCard: Card, activeColor: Color): boolean {
    if (!topCard) return true;
    if (playedCard.color === 'Wild') return true;
    if (playedCard.color === activeColor) return true;
    if (playedCard.value === topCard.value) return true;
    return false;
  }

  playCard(playerId: string, cardId: string, chosenWildColor?: Color) {
    if (this.winner) throw new Error("Game is over.");
    const player = this.players[this.currentPlayerIndex];
    if (player.id !== playerId) throw new Error("Not your turn!");

    const cardIndex = player.hand.findIndex(c => c.id === cardId);
    if (cardIndex === -1) throw new Error("Card not in hand!");
    const card = player.hand[cardIndex];

    const topCard = this.discardPile[this.discardPile.length - 1];
    
    if (!this.isValidMove(card, topCard, this.activeColor!)) {
      throw new Error("Invalid move!");
    }

    if (card.color === 'Wild' && !chosenWildColor) {
      throw new Error("Must choose a color for Wild card.");
    }

    // Execute move
    player.hand.splice(cardIndex, 1);
    this.discardPile.push(card);
    
    this.activeColor = card.color === 'Wild' ? chosenWildColor! : card.color;
    let cardName = card.color === 'Wild' ? `${card.value} (Set to ${chosenWildColor})` : `${card.color} ${card.value}`;
    this.log(`${player.name} played ${cardName}.`);

    if (player.hand.length === 0) {
      this.winner = player;
      this.log(`${player.name} wins!`);
      return;
    }

    if (player.hand.length === 1) {
      this.log(`${player.name} says UNO!`);
    }

    this.applyCardEffect(card);
    this.nextTurn();
  }

  drawForCurrentPlayer() {
    if (this.winner) return;
    const player = this.players[this.currentPlayerIndex];
    const card = this.drawCard();
    player.hand.push(card);
    this.log(`${player.name} drew a card.`);
    this.nextTurn();
  }

  makeBotMove(botId: string) {
    if (this.winner) return;
    const player = this.players[this.currentPlayerIndex];
    if (!player || player.id !== botId) return;

    const topCard = this.discardPile[this.discardPile.length - 1];
    const playableCards = player.hand.filter(card => this.isValidMove(card, topCard, this.activeColor!));

    if (playableCards.length === 0) {
      this.drawForCurrentPlayer();
      return;
    }

    // Prioritize Action cards (Skip, Reverse, Draw2) > Matching color/value non-Wild > Wild
    let chosenCard = playableCards.find(c => ['Skip', 'Reverse', 'Draw2'].includes(c.value));
    if (!chosenCard) {
      chosenCard = playableCards.find(c => c.color !== 'Wild');
    }
    if (!chosenCard) {
      chosenCard = playableCards[0];
    }

    let chosenWildColor: Color | undefined = undefined;
    if (chosenCard.color === 'Wild') {
      const colorCounts: Record<Color, number> = { Red: 0, Yellow: 0, Green: 0, Blue: 0, Wild: 0 };
      player.hand.forEach(c => {
        if (c.color !== 'Wild') colorCounts[c.color]++;
      });
      let bestColor: Color = 'Red';
      let maxCount = -1;
      (['Red', 'Yellow', 'Green', 'Blue'] as Color[]).forEach(c => {
        if (colorCounts[c] > maxCount) {
          maxCount = colorCounts[c];
          bestColor = c;
        }
      });
      chosenWildColor = bestColor;
    }

    this.playCard(botId, chosenCard.id, chosenWildColor);
  }

  private applyCardEffect(card: Card) {
    if (card.value === 'Reverse') {
      this.direction = (this.direction * -1) as 1 | -1;
      this.log("Direction reversed.");
      if (this.players.length === 2) {
        // In 2 player, reverse acts like skip
        this.nextTurn();
      }
    } else if (card.value === 'Skip') {
      this.log(`${this.getNextPlayer().name} is skipped.`);
      this.nextTurn();
    } else if (card.value === 'Draw2') {
      const nextPlayer = this.getNextPlayer();
      nextPlayer.hand.push(this.drawCard());
      nextPlayer.hand.push(this.drawCard());
      this.log(`${nextPlayer.name} draws 2 cards and is skipped.`);
      this.nextTurn();
    } else if (card.value === 'WildDraw4') {
      const nextPlayer = this.getNextPlayer();
      for (let i = 0; i < 4; i++) {
        nextPlayer.hand.push(this.drawCard());
      }
      this.log(`${nextPlayer.name} draws 4 cards and is skipped.`);
      this.nextTurn();
    }
  }

  private getNextPlayer(): Player {
    let nextIndex = (this.currentPlayerIndex + this.direction) % this.players.length;
    if (nextIndex < 0) nextIndex += this.players.length;
    return this.players[nextIndex];
  }

  private nextTurn() {
    this.currentPlayerIndex = (this.currentPlayerIndex + this.direction) % this.players.length;
    if (this.currentPlayerIndex < 0) this.currentPlayerIndex += this.players.length;
    this.log(`It's now ${this.players[this.currentPlayerIndex].name}'s turn.`);
  }

  private log(message: string) {
    this.messages.push(message);
    if (this.messages.length > 50) this.messages.shift(); // Keep last 50 logs
  }
}

