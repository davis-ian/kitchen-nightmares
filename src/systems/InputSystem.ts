import { currentGameState, pauseGame, resumeGame } from '@/core/GameController'
import { System, World } from '@/engine'
import { ComponentType } from '@/engine/ComponentType'
import type { InputComponent } from '@/components/Input'

export class InputSystem extends System {
    private keys = new Set<string>()

    constructor() {
        super()
        window.addEventListener('keydown', (e) => this.keys.add(e.code))
        window.addEventListener('keyup', (e) => this.keys.delete(e.code))
    }

    update(world: World): void {
        for (const entity of world.entities.values()) {
            if (entity.hasComponent(ComponentType.Input)) {
                const input = entity.getComponent<InputComponent>(ComponentType.Input)!

                const escapeDown = this.keys.has('Escape')

                if (escapeDown && !input.pausePressedLastFrame) {
                    if (currentGameState() === 'playing') {
                        pauseGame()
                    } else {
                        resumeGame()
                    }
                }

                const dashKeyDown = this.keys.has('ShiftLeft') || this.keys.has('ShiftRight')

                // Dash only triggers on new press (just like attack)
                input.dash = dashKeyDown && !input.dashPressedLastFrame
                input.dashPressedLastFrame = dashKeyDown

                input.pausePressedLastFrame = escapeDown

                input.up = this.keys.has('KeyW') || this.keys.has('ArrowUp')
                input.down = this.keys.has('KeyS') || this.keys.has('ArrowDown')
                input.left = this.keys.has('KeyA') || this.keys.has('ArrowLeft')
                input.right = this.keys.has('KeyD') || this.keys.has('ArrowRight')
                const attackKeyDown = this.keys.has('Space')

                //Only  trigger new attack if its just been pressed, not looping attack for holding attack btn
                input.attack = attackKeyDown && !input.attackPressedLastFrame

                // store current key state to detect new frame
                input.attackPressedLastFrame = attackKeyDown
            }
        }
    }
}
