import {
    Clock,
    Scene,
    PerspectiveCamera,
    WebGLRenderer,
    AmbientLight,
    DirectionalLight,
    MathUtils,
} from 'three'

// ECS imports
import { RenderSystem } from '@/systems/RenderSystem'
import { RotationSystem } from '@/systems/RotationSystem'
import { InputSystem } from '@/systems/InputSystem'
import { CameraSystem } from '@/systems/CameraSystem'
import { LifespanSystem } from '@/systems/LifespanSystem'
import { PlayerAttackSystem } from '@/systems/PlayerAttackSystem'
import { DamageSystem } from '@/systems/DamageSystem'
import { HealthBarSystem } from '@/systems/HealthBarSystem'
import { HealthSystem } from '@/systems/HealthSystem'

import { DebugDrawSystem } from '@/systems/DebugDrawSystem'
import { ComponentType } from '@/engine/ComponentType'
import { World } from '@/engine'
import { LevelGenerator } from '@/gameplay/level/LevelGenerator'
import { MiniMap } from '@/gameplay/ui/Minimap'
import { RoomExitDetectionSystem } from '@/systems/RoomExitDetectionSystem'
import { RoomManager } from '@/gameplay/level/RoomManager'
import { VelocitySystem } from '@/systems/VelocitySystem'
import { AttackRegistry } from '@/gameplay/actions/combat/AttackRegistry'
import { MovementSystem } from '@/systems/MovementSystem'
import { DamageFlashSystem } from '@/systems/DamageFlashSystem'
import { SpriteAnimationSystem } from '@/systems/SpriteAnimationSystem'
import { SpriteAnimationStateSystem } from '@/systems/SpriteAnimationStateSystem'
import { gameState } from './GameController'
import { EnemyAISystem } from '@/systems/EnemyAISystem'
import { DashSystem } from '@/systems/DashSystem'
import { setCameraSystem } from './services/CameraService'
import { hitPauseService } from './services/HitPauseService'
import { registerDebugHandler } from '@/utils/DebugVisualRegistry'
import { addBoxDeugHelperForEntity } from '@/utils/createBoxDebugHelper'
import { updateEnemyCount } from '@/utils/roomUtils'
import { debugSettings } from '@/core/GameState'
import { FireProjectileSystem } from '@/systems/FireProjectileSystem'
// import { ProjectileCollisionSystem } from '@/systems/ProjectileCollisionSystem'
import { initMouseTracking } from './services/InputService'
import { createCrosshairMesh, CrosshairSystem } from '@/systems/CrosshairSystem'

export function initGame(container: HTMLElement) {
    const DEBUG = debugSettings.value.logState || debugSettings.value.logAll

    if (DEBUG) {
        console.log('game start initiated')
    }
    /**
     * Core rendering setup: scene, camera, renderer
     */
    const scene = new Scene()

    const camera = new PerspectiveCamera(
        75,
        container.clientWidth / container.clientHeight,
        0.1,
        1000
    )

    //Set isometric camera
    // camera.position.set(0, 7, 5)

    const distance = 30.22
    const angleRadians = MathUtils.degToRad(45)
    // const angleRadians = MathUtils.degToRad(20)

    const y = Math.sin(angleRadians) * distance
    const z = Math.cos(angleRadians) * distance

    camera.position.set(0, y, z)
    camera.lookAt(0, -30, 0)

    const ambient = new AmbientLight(0xffffff, 0.5)
    scene.add(ambient)

    const directional = new DirectionalLight(0xffffff, 1)
    directional.position.set(5, 5, 5)
    scene.add(directional)

    if (DEBUG) {
        console.log('camera z', camera.position.z)
    }

    const renderer = new WebGLRenderer({ antialias: true })
    renderer.setSize(container.clientWidth, container.clientHeight)
    container.appendChild(renderer.domElement)

    if (DEBUG) {
        console.log('Canvas size:', renderer.domElement.width, renderer.domElement.height)
    }
    registerDebugHandler((world, entity) => {
        if (entity.hasComponent(ComponentType.Hitbox)) {
            addBoxDeugHelperForEntity(world, entity)
        }
    })
    registerDebugHandler((world, entity) => {
        if (entity.hasComponent(ComponentType.Hurtbox)) {
            addBoxDeugHelperForEntity(world, entity)
        }
    })

    const clock = new Clock()
    const cameraSystem = new CameraSystem(camera)
    /**
     * Initialize ECS world and register systems
     */
    const world = new World()
    world.setScene(scene)

    initMouseTracking(camera, renderer)

    const generator = new LevelGenerator()
    const roomGraph = generator.init(world, 10)
    const attackRegistry = new AttackRegistry()
    const roomManager = new RoomManager(world, roomGraph)
    const minimap = new MiniMap(roomManager)
    const crosshair = createCrosshairMesh()
    scene.add(crosshair)
    /**
     * Create a cube mesh and attach to ECS entity
     * The cube's transform will be driven by ECS data and systems
     */

    // loadLevel(world, testLevel, scene)

    roomManager.setActiveRoom('0,0')
    world.addSystem(new InputSystem())
    world.addSystem(new VelocitySystem())
    world.addSystem(new DashSystem())
    world.addSystem(new MovementSystem())

    world.addSystem(new EnemyAISystem(attackRegistry))

    world.addSystem(new RenderSystem())
    world.addSystem(new RotationSystem())

    world.addSystem(new PlayerAttackSystem(attackRegistry))
    world.addSystem(new LifespanSystem(attackRegistry))
    world.addSystem(new FireProjectileSystem())
    // world.addSystem(new ProjectileCollisionSystem())
    world.addSystem(new DamageSystem())
    world.addSystem(new DamageFlashSystem())
    world.addSystem(new HealthBarSystem())
    world.addSystem(new HealthSystem(roomManager))
    world.addSystem(cameraSystem)

    //register camera service
    setCameraSystem(cameraSystem)
    world.addSystem(new DebugDrawSystem())
    world.addSystem(new RoomExitDetectionSystem(roomManager))
    world.addSystem(new SpriteAnimationSystem())
    world.addSystem(new SpriteAnimationStateSystem())
    world.addSystem(new CrosshairSystem(crosshair))

    let animationFrameId: number
    /**
     * Animation loop
     * Runs the ECS world update and renders the scene
     */
    function animate() {
        const rawDelta = clock.getDelta()
        const delta = hitPauseService.update(rawDelta)

        if (delta > 0) {
            world.update(delta)
            minimap.update(world)
        }

        renderer.render(scene, camera)
        animationFrameId = requestAnimationFrame(animate)
    }

    const onResize = () => {
        const width = container.clientWidth
        const height = container.clientHeight
        camera.aspect = width / height
        camera.updateProjectionMatrix()
        renderer.setSize(width, height)
    }
    window.addEventListener('resize', onResize)
    gameState.value = 'playing'
    animate()

    //Cleanup
    return () => {
        cancelAnimationFrame(animationFrameId)
        window.removeEventListener('resize', onResize)

        // Dispose renderer and remove canvas
        renderer.dispose?.()
        if (renderer.domElement && container.contains(renderer.domElement)) {
            container.removeChild(renderer.domElement)
        }

        // Clear all meshes from the scene
        scene.traverse((object) => {
            if ((object as any).geometry) {
                ;(object as any).geometry.dispose?.()
            }
            if ((object as any).material) {
                const material = (object as any).material
                if (Array.isArray(material)) {
                    material.forEach((m) => m.dispose?.())
                } else {
                    material.dispose?.()
                }
            }
        })

        while (scene.children.length > 0) {
            scene.remove(scene.children[0])
        }

        world.clear()
        updateEnemyCount(world)
        minimap.dispose()

        if (DEBUG) {
            console.log(roomManager, 'roomManager after reset')
        }
    }
}
